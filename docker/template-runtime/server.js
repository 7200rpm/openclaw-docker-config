#!/usr/bin/env node
const http = require("http");
const path = require("path");
const {
  formatAddress,
  getAttachment,
  getInboxOverview,
  getInboxThreadDetail,
  isConfigured: isAgentMailConfigured,
  sendDraft,
  upsertThreadDraft,
} = require("./lib/agentmail");

const PORT = Number(process.env.TEMPLATE_RUNTIME_PORT || "3001");
const TEMPLATE_SLUG = process.env.TEMPLATE_SLUG || "executive";
const INSTANCE_SLUG = process.env.INSTANCE_SLUG || "";
const INSTANCE_ID = process.env.INSTANCE_ID || "";
const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || "";
const RUNTIME_SYNC_TOKEN = process.env.RUNTIME_SYNC_TOKEN || "";
const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE_DIR || "/home/node/.openclaw/workspace";
const CUSTOMER_TIMEZONE = process.env.CUSTOMER_TIMEZONE || "UTC";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatusPill(status) {
  const normalized = escapeHtml(status || "unknown");
  return `<span class="pill pill-${normalized.replace(/\s+/g, "-")}">${normalized.replace(
    /_/g,
    " "
  )}</span>`;
}

function formatTimestamp(value) {
  if (!value) {
    return "Time TBD";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: CUSTOMER_TIMEZONE,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function fetchSetupState() {
  if (!CONTROL_PLANE_URL || !INSTANCE_SLUG || !RUNTIME_SYNC_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(
      `${CONTROL_PLANE_URL}/api/runtime/instances/${INSTANCE_SLUG}/setup`,
      {
        headers: {
          Authorization: `Bearer ${RUNTIME_SYNC_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function renderActionButtons(actions) {
  return actions
    .map(
      (action) =>
        `<a class="button${action.primary ? " primary" : ""}" href="${escapeHtml(
          action.href
        )}"${action.external ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(
          action.label
        )}</a>`
    )
    .join("");
}

function renderShell({ title, subtitle, body, setupState, actions }) {
  const integrationBadges = (setupState?.integrations || [])
    .filter((integration) => integration.metadata?.enabled)
    .map(
      (integration) => `
        <div class="integration-row">
          <strong>${escapeHtml(integration.metadata?.label || integration.kind)}</strong>
          ${renderStatusPill(integration.status)}
        </div>
      `
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f4f0e8;
        --panel: #fffaf2;
        --panel-strong: #fffcf7;
        --ink: #1f1a16;
        --muted: #6f665d;
        --accent: #0f5f52;
        --line: #dfd5c8;
        --warn: #9f5b00;
        --danger: #8a2f2f;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(15, 95, 82, 0.08), transparent 30%),
          linear-gradient(180deg, #f8f2e9 0%, var(--bg) 100%);
      }
      a { color: var(--accent); text-decoration: none; }
      main {
        max-width: 1240px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: flex-start;
        margin-bottom: 24px;
      }
      .hero h1 {
        margin: 0 0 8px;
        font-size: clamp(2rem, 5vw, 3.4rem);
        line-height: 1;
      }
      .hero p {
        margin: 0;
        max-width: 720px;
        color: var(--muted);
        font-size: 1rem;
      }
      .hero-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .button,
      button.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 11px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
        color: var(--ink);
        font-size: 0.95rem;
        cursor: pointer;
      }
      .button.primary,
      button.button.primary {
        background: var(--accent);
        color: #f7f3ea;
        border-color: var(--accent);
      }
      .button.warn,
      button.button.warn {
        background: rgba(159, 91, 0, 0.1);
        color: var(--warn);
        border-color: rgba(159, 91, 0, 0.2);
      }
      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(12, minmax(0, 1fr));
      }
      .card {
        grid-column: span 12;
        background: rgba(255, 250, 242, 0.9);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 18px 18px 20px;
        box-shadow: 0 18px 40px rgba(31, 26, 22, 0.06);
      }
      .card h2,
      .card h3 {
        margin: 0 0 6px;
      }
      .card .subtle {
        margin: 0 0 16px;
        color: var(--muted);
        font-size: 0.95rem;
      }
      .pill {
        display: inline-flex;
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 0.8rem;
        background: rgba(15, 95, 82, 0.1);
        color: var(--accent);
      }
      .pill-action-required,
      .pill-pending-verification,
      .pill-failed {
        background: rgba(159, 91, 0, 0.12);
        color: var(--warn);
      }
      .integration-row,
      .metric-row,
      .item-row,
      .thread-row,
      .message-row {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid rgba(223, 213, 200, 0.8);
      }
      .integration-row:first-child,
      .metric-row:first-child,
      .item-row:first-child,
      .thread-row:first-child,
      .message-row:first-child {
        border-top: 0;
        padding-top: 0;
      }
      .thread-row.active {
        margin-inline: -10px;
        padding-inline: 10px;
        border-radius: 16px;
        background: rgba(15, 95, 82, 0.08);
      }
      .thread-row a {
        color: inherit;
        display: block;
        width: 100%;
      }
      .big-number {
        font-size: 2.5rem;
        line-height: 1;
        margin: 0;
      }
      .muted {
        color: var(--muted);
      }
      .split {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .inbox-layout {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
      }
      .thread-counts {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .stat {
        border: 1px solid rgba(223, 213, 200, 0.8);
        border-radius: 18px;
        padding: 14px;
        background: var(--panel-strong);
      }
      .thread-subject {
        font-size: 1rem;
        margin: 0 0 4px;
      }
      .message-row {
        flex-direction: column;
      }
      .message-meta,
      .thread-meta,
      .draft-actions,
      .flash {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .draft-box,
      textarea {
        width: 100%;
      }
      textarea {
        min-height: 220px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.75);
        padding: 14px 16px;
        font: inherit;
        color: var(--ink);
      }
      .message-body {
        margin: 0;
        white-space: pre-wrap;
      }
      .flash {
        margin: 0 0 14px;
        padding: 12px 14px;
        border-radius: 16px;
        border: 1px solid rgba(15, 95, 82, 0.18);
        background: rgba(15, 95, 82, 0.08);
        color: var(--accent);
      }
      .flash.error {
        border-color: rgba(138, 47, 47, 0.18);
        background: rgba(138, 47, 47, 0.08);
        color: var(--danger);
      }
      .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tag {
        display: inline-flex;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 0.8rem;
        background: rgba(31, 26, 22, 0.06);
        color: var(--muted);
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        font-family: "SFMono-Regular", "Menlo", monospace;
        font-size: 0.84rem;
        color: var(--muted);
      }
      @media (min-width: 900px) {
        .card.span-4 { grid-column: span 4; }
        .card.span-5 { grid-column: span 5; }
        .card.span-6 { grid-column: span 6; }
        .card.span-7 { grid-column: span 7; }
        .card.span-8 { grid-column: span 8; }
      }
      @media (max-width: 900px) {
        .inbox-layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .hero { flex-direction: column; }
        .split { grid-template-columns: 1fr; }
        .thread-counts { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="hero-actions">
          ${renderActionButtons(actions)}
        </div>
      </section>

      <section class="grid">
        <article class="card span-4">
          <h2>Setup</h2>
          <p class="subtle">Control-plane onboarding and integration readiness.</p>
          <div class="metric-row">
            <span>Onboarding stage</span>
            ${renderStatusPill(setupState?.onboardingStage || "draft")}
          </div>
          ${integrationBadges || '<p class="muted">No enabled integrations yet.</p>'}
        </article>

        ${body}
      </section>
    </main>
  </body>
</html>`;
}

async function renderHomePage() {
  const modulePath = path.join(__dirname, "modules", `${TEMPLATE_SLUG}.js`);
  const templateModule = require(modulePath);
  const setupState = await fetchSetupState();
  const body = await templateModule.render({
    workspaceDir: WORKSPACE_DIR,
    instanceId: INSTANCE_ID,
    instanceSlug: INSTANCE_SLUG,
    customerTimezone: CUSTOMER_TIMEZONE,
    controlPlaneUrl: CONTROL_PLANE_URL,
    runtimeSyncToken: RUNTIME_SYNC_TOKEN,
    escapeHtml,
    setupState,
  });

  return renderShell({
    title: setupState?.displayName || "ClawStaffing Assistant",
    subtitle:
      "A tailored daily workspace for the executive template. Setup state still comes from ClawStaffing, but inbox operations stay on this instance.",
    body,
    setupState,
    actions: [
      { href: "/", label: "Refresh", primary: true },
      { href: "/inbox", label: "Open Inbox" },
      {
        href: "/advanced",
        label: "Open Advanced Console",
        external: true,
      },
    ],
  });
}

function renderThreadList(overview, selectedThreadId) {
  if (!overview.mailbox) {
    return `<p class="muted">AgentMail is not configured on this instance yet.</p>`;
  }

  if (!overview.threads.length) {
    return `<p class="muted">The inbox is live, but there are no threads yet.</p>`;
  }

  return overview.threads
    .map((thread) => {
      const active = thread.id === selectedThreadId ? " active" : "";
      return `
        <div class="thread-row${active}">
          <a href="/inbox?thread=${encodeURIComponent(thread.id)}">
            <div>
              <div class="thread-meta">
                ${renderStatusPill(thread.status)}
                <span class="muted">${escapeHtml(formatTimestamp(thread.lastMessageAt))}</span>
              </div>
              <p class="thread-subject"><strong>${escapeHtml(
                thread.subject || thread.primaryCorrespondent || "Untitled thread"
              )}</strong></p>
              <div class="muted">${escapeHtml(
                thread.primaryCorrespondent || "Unknown sender"
              )}</div>
              ${
                thread.preview
                  ? `<div class="muted">${escapeHtml(thread.preview)}</div>`
                  : ""
              }
            </div>
          </a>
        </div>
      `;
    })
    .join("");
}

function renderMessage(message) {
  const body = message.extractedText || message.textBody || message.preview || "";
  const attachments = message.attachments.length
    ? `
      <div class="tag-list">
        ${message.attachments
          .map(
            (attachment) => `
              <a class="tag" href="/inbox/messages/${encodeURIComponent(
                message.id
              )}/attachments/${encodeURIComponent(attachment.id)}">
                ${escapeHtml(attachment.filename || "Attachment")}
              </a>
            `
          )
          .join("")}
      </div>
    `
    : "";

  return `
    <div class="message-row">
      <div class="message-meta">
        ${renderStatusPill(message.direction)}
        <strong>${escapeHtml(formatAddress(message.from))}</strong>
        <span class="muted">${escapeHtml(formatTimestamp(message.createdAt))}</span>
      </div>
      <div class="muted">To: ${escapeHtml(
        message.to.map(formatAddress).join(", ") || "None"
      )}</div>
      ${attachments}
      <pre class="message-body">${escapeHtml(body || "No message body available.")}</pre>
    </div>
  `;
}

function renderInboxBody(overview, detail, flash) {
  if (!overview.mailbox) {
    return `
      <article class="card span-8">
        <h2>Inbox</h2>
        <p class="subtle">Inbox operations now run directly on the instance, but this mailbox has not been provisioned yet.</p>
        <p class="muted">Redeploy the instance after the control plane provisions the AgentMail runtime secret.</p>
      </article>
    `;
  }

  const summary = overview.mailbox.summary;
  const messageList = detail
    ? detail.messages.map(renderMessage).join("")
    : '<p class="muted">Select a thread to inspect messages and manage the draft.</p>';

  return `
    <article class="card span-8">
      <h2>Inbox</h2>
      <p class="subtle">AgentMail is connected directly to this instance.</p>
      ${
        flash
          ? `<div class="flash${flash.type === "error" ? " error" : ""}">${escapeHtml(
              flash.message
            )}</div>`
          : ""
      }
      <div class="thread-counts">
        <div class="stat">
          <p class="big-number">${escapeHtml(String(summary.openThreads))}</p>
          <div class="muted">Open</div>
        </div>
        <div class="stat">
          <p class="big-number">${escapeHtml(String(summary.draftReadyThreads))}</p>
          <div class="muted">Draft ready</div>
        </div>
        <div class="stat">
          <p class="big-number">${escapeHtml(String(summary.awaitingReplyThreads))}</p>
          <div class="muted">Awaiting reply</div>
        </div>
      </div>
      <div class="metric-row">
        <span>Inbox address</span>
        <span class="muted">${escapeHtml(overview.mailbox.emailAddress)}</span>
      </div>
      <div class="inbox-layout">
        <div class="card">
          <h3>Threads</h3>
          <p class="subtle">Recent work intake and forwarded conversations.</p>
          ${renderThreadList(overview, detail?.thread?.id || null)}
        </div>
        <div class="card">
          ${
            detail
              ? `
                <h3>${escapeHtml(
                  detail.thread.subject ||
                    detail.thread.primaryCorrespondent ||
                    "Untitled thread"
                )}</h3>
                <p class="subtle">${escapeHtml(detail.thread.agentSummary)}</p>
                <div class="thread-meta">
                  ${renderStatusPill(detail.thread.status)}
                  <span class="muted">${escapeHtml(
                    detail.thread.primaryCorrespondent || "Unknown contact"
                  )}</span>
                </div>
                ${messageList}
                <div class="card" style="margin-top: 18px;">
                  <h3>Draft Reply</h3>
                  <p class="subtle">Save the reply here, then send it from the instance after review.</p>
                  <form method="POST" action="/inbox/draft">
                    <input type="hidden" name="threadId" value="${escapeHtml(detail.thread.id)}" />
                    <textarea name="text" placeholder="Draft the reply here...">${escapeHtml(
                      detail.draft?.textBody || ""
                    )}</textarea>
                    <div class="draft-actions" style="margin-top: 12px;">
                      <button class="button primary" type="submit">Save Draft</button>
                    </div>
                  </form>
                  ${
                    detail.draft
                      ? `
                        <form method="POST" action="/inbox/drafts/${encodeURIComponent(
                          detail.draft.id
                        )}/send" style="margin-top: 12px;">
                          <input type="hidden" name="threadId" value="${escapeHtml(
                            detail.thread.id
                          )}" />
                          <button class="button warn" type="submit">Send Reply</button>
                        </form>
                      `
                      : ""
                  }
                </div>
              `
              : `
                <h3>Thread Detail</h3>
                <p class="subtle">Select a thread on the left to read the conversation and manage a draft.</p>
              `
          }
        </div>
      </div>
    </article>
  `;
}

async function renderInboxPage(url) {
  const setupState = await fetchSetupState();
  const flash = url.searchParams.get("error")
    ? { type: "error", message: url.searchParams.get("error") }
    : url.searchParams.get("notice")
      ? { type: "notice", message: url.searchParams.get("notice") }
      : null;
  const overview = isAgentMailConfigured()
    ? await getInboxOverview(25)
    : { mailbox: null, threads: [] };
  const selectedThreadId =
    url.searchParams.get("thread") || overview.threads[0]?.id || null;
  const detail =
    selectedThreadId && overview.mailbox
      ? await getInboxThreadDetail(selectedThreadId)
      : null;

  return renderShell({
    title: setupState?.displayName || "ClawStaffing Assistant",
    subtitle:
      "Inbox threads, draft replies, and attachment access now run locally on this instance with AgentMail as the mailbox backend.",
    body: renderInboxBody(overview, detail, flash),
    setupState,
    actions: [
      { href: "/", label: "Back Home" },
      { href: "/inbox", label: "Refresh Inbox", primary: true },
      {
        href: "/advanced",
        label: "Open Advanced Console",
        external: true,
      },
    ],
  });
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(payload);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseForm(body) {
  return new URLSearchParams(body);
}

async function handleDraftSave(req, res) {
  const params = parseForm(await readRequestBody(req));
  const threadId = params.get("threadId") || "";
  const text = params.get("text") || "";

  if (!threadId) {
    redirect(res, "/inbox?error=Missing%20thread");
    return;
  }

  if (!text.trim()) {
    redirect(res, `/inbox?thread=${encodeURIComponent(threadId)}&error=Draft%20cannot%20be%20empty`);
    return;
  }

  try {
    await upsertThreadDraft(threadId, { text: text.trim() });
    redirect(
      res,
      `/inbox?thread=${encodeURIComponent(threadId)}&notice=Draft%20saved`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save draft";
    redirect(
      res,
      `/inbox?thread=${encodeURIComponent(threadId)}&error=${encodeURIComponent(
        message
      )}`
    );
  }
}

async function handleDraftSend(req, res, draftId) {
  const params = parseForm(await readRequestBody(req));
  const threadId = params.get("threadId") || "";

  if (!draftId) {
    redirect(res, "/inbox?error=Missing%20draft");
    return;
  }

  try {
    const sent = await sendDraft(draftId);
    const nextThreadId = sent?.threadId || threadId;
    redirect(
      res,
      `/inbox?thread=${encodeURIComponent(
        nextThreadId
      )}&notice=Reply%20sent`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send draft";
    redirect(
      res,
      `/inbox?thread=${encodeURIComponent(threadId)}&error=${encodeURIComponent(
        message
      )}`
    );
  }
}

async function handleAttachment(req, res, messageId, attachmentId) {
  if (!messageId || !attachmentId) {
    sendText(res, 404, "Attachment not found");
    return;
  }

  try {
    const attachment = await getAttachment(messageId, attachmentId);
    redirect(res, attachment.downloadUrl);
  } catch (error) {
    console.error("Attachment redirect failed:", error);
    sendText(res, 404, "Attachment not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Bad request");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      template: TEMPLATE_SLUG,
      instanceId: INSTANCE_ID,
      inboxConfigured: isAgentMailConfigured(),
    });
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/") {
      const html = await renderHomePage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/inbox") {
      const html = await renderInboxPage(url);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && url.pathname === "/inbox/draft") {
      await handleDraftSave(req, res);
      return;
    }

    const draftSendMatch = url.pathname.match(/^\/inbox\/drafts\/([^/]+)\/send$/);
    if (req.method === "POST" && draftSendMatch) {
      await handleDraftSend(req, res, decodeURIComponent(draftSendMatch[1]));
      return;
    }

    const attachmentMatch = url.pathname.match(
      /^\/inbox\/messages\/([^/]+)\/attachments\/([^/]+)$/
    );
    if (req.method === "GET" && attachmentMatch) {
      await handleAttachment(
        req,
        res,
        decodeURIComponent(attachmentMatch[1]),
        decodeURIComponent(attachmentMatch[2])
      );
      return;
    }

    sendText(res, 404, "Not found");
  } catch (error) {
    console.error("Template runtime error:", error);
    sendText(res, 500, "Template runtime failed to render.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Template runtime listening on ${PORT}`);
});
