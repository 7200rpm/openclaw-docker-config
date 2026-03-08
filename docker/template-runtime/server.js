#!/usr/bin/env node
const http = require("http");
const path = require("path");

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

function renderShell({ title, subtitle, body, setupState }) {
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
        --ink: #1f1a16;
        --muted: #6f665d;
        --accent: #0f5f52;
        --line: #dfd5c8;
        --warn: #9f5b00;
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
        max-width: 1200px;
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
        max-width: 680px;
        color: var(--muted);
        font-size: 1rem;
      }
      .hero-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 11px 16px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
        color: var(--ink);
        font-size: 0.95rem;
      }
      .button.primary {
        background: var(--accent);
        color: #f7f3ea;
        border-color: var(--accent);
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
      .card h2 {
        margin: 0 0 6px;
        font-size: 1.15rem;
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
      .item-row {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid rgba(223, 213, 200, 0.8);
      }
      .integration-row:first-child,
      .metric-row:first-child,
      .item-row:first-child {
        border-top: 0;
        padding-top: 0;
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
      @media (max-width: 720px) {
        .hero { flex-direction: column; }
        .split { grid-template-columns: 1fr; }
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
          <a class="button primary" href="/">Refresh</a>
          <a class="button" href="/advanced" target="_blank" rel="noopener">Open Advanced Console</a>
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

async function handleRoot() {
  const modulePath = path.join(__dirname, "modules", `${TEMPLATE_SLUG}.js`);
  const templateModule = require(modulePath);
  const setupState = await fetchSetupState();
  const body = await templateModule.render({
    workspaceDir: WORKSPACE_DIR,
    instanceId: INSTANCE_ID,
    instanceSlug: INSTANCE_SLUG,
    customerTimezone: CUSTOMER_TIMEZONE,
    escapeHtml,
    setupState,
  });

  return renderShell({
    title: setupState?.displayName || "ClawStaffing Assistant",
    subtitle:
      "A tailored daily workspace for the executive template. Data-heavy views stay on the instance; setup state stays coordinated with ClawStaffing.",
    body,
    setupState,
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        template: TEMPLATE_SLUG,
        instanceId: INSTANCE_ID,
      })
    );
    return;
  }

  if (url.pathname !== "/") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  try {
    const html = await handleRoot();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    console.error("Template runtime error:", error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Template runtime failed to render.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Template runtime listening on ${PORT}`);
});
