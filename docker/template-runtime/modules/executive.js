const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function runJsonCommand(command, args, cwd) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd,
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 5,
    });

    return JSON.parse(stdout || "null");
  } catch {
    return null;
  }
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function findLatestMemoryLog(workspaceDir) {
  const memoryDir = path.join(workspaceDir, "memory");

  try {
    const entries = fs
      .readdirSync(memoryDir)
      .filter((entry) => entry.endsWith(".md"))
      .sort()
      .reverse();

    if (!entries.length) {
      return "";
    }

    return readTextFile(path.join(memoryDir, entries[0]));
  } catch {
    return "";
  }
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(\\n## |$)`, "i");
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function parseUpcomingEvents(calendarPayload) {
  const items = calendarPayload?.items || calendarPayload || [];
  return Array.isArray(items) ? items.slice(0, 5) : [];
}

function parseTasks(taskPayload) {
  const items = taskPayload?.items || taskPayload || [];
  return Array.isArray(items) ? items.slice(0, 6) : [];
}

async function getExecutiveData(workspaceDir, customerTimezone, setupState) {
  const memoryMarkdown = readTextFile(path.join(workspaceDir, "MEMORY.md"));
  const latestBriefing = findLatestMemoryLog(workspaceDir);
  const waitingOn = extractSection(memoryMarkdown, "Waiting On");

  const googleWorkspaceConnected = (setupState?.integrations || []).some(
    (integration) =>
      integration.kind === "google_workspace" &&
      integration.metadata?.enabled &&
      integration.status === "connected"
  );

  if (!googleWorkspaceConnected) {
    return {
      latestBriefing,
      waitingOn,
      todayEvents: [],
      tasks: [],
      unreadSummary: null,
      needsGoogleWorkspace: true,
      customerTimezone,
    };
  }

  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [calendarPayload, taskPayload, unreadPayload] = await Promise.all([
    runJsonCommand(
      "gws",
      [
        "calendar",
        "events",
        "list",
        "--params",
        JSON.stringify({
          calendarId: "primary",
          timeMin: now.toISOString(),
          timeMax: later.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        }),
      ],
      workspaceDir
    ),
    runJsonCommand(
      "gws",
      [
        "tasks",
        "tasks",
        "list",
        "--params",
        JSON.stringify({
          tasklist: "@default",
          showCompleted: false,
        }),
      ],
      workspaceDir
    ),
    runJsonCommand(
      "gws",
      [
        "gmail",
        "users.messages",
        "list",
        "--params",
        JSON.stringify({
          userId: "me",
          q: "is:unread",
          maxResults: 12,
        }),
      ],
      workspaceDir
    ),
  ]);

  return {
    latestBriefing,
    waitingOn,
    todayEvents: parseUpcomingEvents(calendarPayload),
    tasks: parseTasks(taskPayload),
    unreadSummary: unreadPayload,
    needsGoogleWorkspace: false,
    customerTimezone,
  };
}

function renderList(items, renderItem, emptyText) {
  if (!items.length) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return items
    .map((item) => `<div class="item-row">${renderItem(item)}</div>`)
    .join("");
}

exports.render = async function renderExecutive(context) {
  const data = await getExecutiveData(
    context.workspaceDir,
    context.customerTimezone,
    context.setupState
  );

  const unreadCount = Array.isArray(data.unreadSummary?.messages)
    ? data.unreadSummary.messages.length
    : Array.isArray(data.unreadSummary)
      ? data.unreadSummary.length
      : 0;

  return `
    <article class="card span-8">
      <h2>Daily Briefing</h2>
      <p class="subtle">Latest memory log and operational context from the assistant.</p>
      <pre>${context.escapeHtml(
        data.latestBriefing || "No daily briefing has been captured yet."
      )}</pre>
    </article>

    <article class="card span-4">
      <h2>Quick Actions</h2>
      <p class="subtle">Operational shortcuts for the executive assistant workflow.</p>
      <div class="split">
        <a class="button primary" href="/advanced" target="_blank" rel="noopener">Triage Inbox</a>
        <a class="button" href="/advanced" target="_blank" rel="noopener">Prep Next Meeting</a>
        <a class="button" href="/advanced" target="_blank" rel="noopener">Review Tasks</a>
        <a class="button" href="/advanced" target="_blank" rel="noopener">Open Agent Chat</a>
      </div>
    </article>

    <article class="card span-4">
      <h2>Inbox Summary</h2>
      <p class="subtle">Unread inbox snapshot from Gmail via Google Workspace CLI.</p>
      ${
        data.needsGoogleWorkspace
          ? '<p class="muted">Connect Google Workspace in ClawStaffing to unlock inbox summary.</p>'
          : `<p class="big-number">${unreadCount}</p><p class="muted">Unread messages</p>`
      }
    </article>

    <article class="card span-4">
      <h2>Today</h2>
      <p class="subtle">Upcoming meetings in the next 24 hours.</p>
      ${renderList(
        data.todayEvents,
        (event) => {
          const start = event.start?.dateTime || event.start?.date || "Time TBD";
          return `
            <div>
              <strong>${context.escapeHtml(event.summary || "Untitled event")}</strong>
              <div class="muted">${context.escapeHtml(start)}</div>
            </div>
            <span class="muted">${context.escapeHtml(event.location || "")}</span>
          `;
        },
        "No upcoming events found."
      )}
    </article>

    <article class="card span-4">
      <h2>Tasks</h2>
      <p class="subtle">Current task backlog from the configured task system.</p>
      ${renderList(
        data.tasks,
        (task) => `
          <div>
            <strong>${context.escapeHtml(task.title || "Untitled task")}</strong>
            <div class="muted">${context.escapeHtml(task.due || "No due date")}</div>
          </div>
        `,
        "No tasks available."
      )}
    </article>

    <article class="card span-6">
      <h2>Waiting On</h2>
      <p class="subtle">Outstanding follow-ups captured in MEMORY.md.</p>
      <pre>${context.escapeHtml(
        data.waitingOn || "No waiting-on items are recorded yet."
      )}</pre>
    </article>

    <article class="card span-6">
      <h2>Notes</h2>
      <p class="subtle">Runtime scope and data locality.</p>
      <div class="metric-row">
        <span>Instance ID</span>
        <span class="muted">${context.escapeHtml(context.instanceId || "unknown")}</span>
      </div>
      <div class="metric-row">
        <span>Customer timezone</span>
        <span class="muted">${context.escapeHtml(data.customerTimezone)}</span>
      </div>
      <div class="metric-row">
        <span>Business data path</span>
        <span class="muted">Local only</span>
      </div>
    </article>
  `;
};
