const AGENTMAIL_API_BASE_URL = (
  process.env.AGENTMAIL_API_BASE_URL || "https://api.agentmail.to"
).replace(/\/+$/, "");
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY || "";
const AGENTMAIL_INBOX_ID = process.env.AGENTMAIL_INBOX_ID || "";
const AGENTMAIL_EMAIL_ADDRESS = process.env.AGENTMAIL_EMAIL_ADDRESS || "";
const AGENTMAIL_INBOX_USERNAME = process.env.AGENTMAIL_INBOX_USERNAME || "";
const AGENTMAIL_INBOX_DOMAIN = process.env.AGENTMAIL_INBOX_DOMAIN || "";

function parseTimestamp(...values) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function parseAddress(raw) {
  const value = String(raw || "").trim();
  const match = value.match(/^(.*)<([^>]+)>$/);

  if (!match) {
    return {
      raw: value,
      email: value.replace(/^mailto:/i, "").trim(),
      displayName: null,
    };
  }

  const displayName = match[1].replaceAll('"', "").trim() || null;
  return {
    raw: value,
    email: match[2].trim(),
    displayName,
  };
}

function formatAddress(raw) {
  const address = parseAddress(raw);

  if (!address.email) {
    return address.raw;
  }

  return address.displayName
    ? `${address.displayName} <${address.email}>`
    : address.email;
}

function primaryAddress(values) {
  return Array.isArray(values) && values.length > 0 ? parseAddress(values[0]) : null;
}

function isOutbound(from) {
  return String(from || "")
    .toLowerCase()
    .includes(AGENTMAIL_EMAIL_ADDRESS.toLowerCase());
}

function threadStatus(thread, draft) {
  if (draft) {
    return "draft_ready";
  }

  return isOutbound(thread.messages.at(-1)?.from || "") ? "awaiting_reply" : "open";
}

function summarizeThread(thread, draft) {
  const lastMessage = thread.messages.at(-1) || null;
  const correspondent =
    primaryAddress(thread.senders) || primaryAddress(thread.recipients);
  const label = correspondent?.displayName || correspondent?.email || "the thread";

  if (draft) {
    return `Draft ready for ${label}.`;
  }

  if (!lastMessage) {
    return `No messages have loaded for ${label}.`;
  }

  return isOutbound(lastMessage.from)
    ? `Awaiting a reply from ${label}.`
    : `Latest message came in from ${label}.`;
}

function inferSummaryLastDirection(threadItem) {
  const sentAt = parseTimestamp(threadItem.sentTimestamp);
  const receivedAt = parseTimestamp(threadItem.receivedTimestamp);

  if (sentAt && (!receivedAt || sentAt >= receivedAt)) {
    return "outbound";
  }

  return "inbound";
}

function toThreadSummary(thread, draft) {
  const lastMessage = thread.messages.at(-1) || null;
  const primaryCorrespondent = primaryAddress(
    isOutbound(lastMessage?.from || "")
      ? thread.recipients
      : thread.senders
  );

  return {
    id: thread.threadId,
    status: threadStatus(thread, draft),
    subject: thread.subject || null,
    preview: thread.preview || null,
    lastMessageAt: parseTimestamp(
      thread.updatedAt,
      thread.receivedTimestamp,
      thread.sentTimestamp,
      thread.timestamp
    ),
    lastDirection: isOutbound(lastMessage?.from || "") ? "outbound" : "inbound",
    messageCount: thread.messageCount || thread.messages.length || 0,
    primaryCorrespondent: primaryCorrespondent?.displayName || primaryCorrespondent?.email || null,
    primaryCorrespondentEmail: primaryCorrespondent?.email || null,
    hasAttachments: Array.isArray(thread.attachments) && thread.attachments.length > 0,
    senders: Array.isArray(thread.senders) ? thread.senders : [],
    recipients: Array.isArray(thread.recipients) ? thread.recipients : [],
    agentSummary: summarizeThread(thread, draft),
  };
}

function toMessageDto(message) {
  return {
    id: message.messageId,
    direction: isOutbound(message.from) ? "outbound" : "inbound",
    from: message.from,
    to: Array.isArray(message.to) ? message.to : [],
    cc: Array.isArray(message.cc) ? message.cc : [],
    bcc: Array.isArray(message.bcc) ? message.bcc : [],
    subject: message.subject || null,
    preview: message.preview || null,
    textBody: message.text || null,
    extractedText: message.extractedText || null,
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((attachment) => ({
          id: attachment.attachmentId,
          filename: attachment.filename || null,
          sizeBytes: attachment.size || 0,
          contentType: attachment.contentType || null,
        }))
      : [],
    createdAt: parseTimestamp(message.createdAt, message.updatedAt, message.timestamp),
  };
}

function toDraftDto(draft) {
  if (!draft) {
    return null;
  }

  return {
    id: draft.draftId,
    status: draft.sendStatus === "sent" ? "sent" : "pending_approval",
    textBody: draft.text || null,
    subject: draft.subject || null,
    to: Array.isArray(draft.to) ? draft.to : [],
    updatedAt: parseTimestamp(draft.updatedAt, draft.createdAt) || new Date().toISOString(),
    approvedAt: null,
  };
}

async function agentmailRequest(path, options = {}) {
  if (!AGENTMAIL_API_KEY || !AGENTMAIL_INBOX_ID) {
    throw new Error("AgentMail runtime is not configured.");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${AGENTMAIL_API_KEY}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${AGENTMAIL_API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message || payload?.error || `AgentMail request failed (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function listThreadItems(limit = 25) {
  const payload = await agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/threads?limit=${limit}&includeTrash=false`
  );

  return Array.isArray(payload?.threads) ? payload.threads : [];
}

async function getThread(threadId) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/threads/${encodeURIComponent(threadId)}`
  );
}

async function listDraftItems(limit = 50) {
  const payload = await agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/drafts?limit=${limit}`
  );

  return Array.isArray(payload?.drafts) ? payload.drafts : [];
}

async function getDraft(draftId) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/drafts/${encodeURIComponent(draftId)}`
  );
}

async function getLatestDraftForThread(threadId) {
  const drafts = await listDraftItems(50);
  const match = drafts.find((draft) => draft.threadId === threadId);
  return match ? getDraft(match.draftId) : null;
}

async function createDraft(threadId, input) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/drafts`,
    {
      method: "POST",
      body: input,
    }
  );
}

async function updateDraft(draftId, input) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/drafts/${encodeURIComponent(draftId)}`,
    {
      method: "PATCH",
      body: input,
    }
  );
}

async function sendDraft(draftId) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/drafts/${encodeURIComponent(draftId)}/send`,
    {
      method: "POST",
      body: {},
    }
  );
}

function replyTargetForMessage(message) {
  const replyTarget = primaryAddress(message.replyTo) || parseAddress(message.from);
  return replyTarget?.email || "";
}

async function upsertThreadDraft(threadId, input) {
  const thread = await getThread(threadId);
  const existingDraft = await getLatestDraftForThread(threadId);
  const lastMessage = Array.isArray(thread.messages) ? thread.messages.at(-1) : null;

  if (!lastMessage) {
    throw new Error("Thread has no messages.");
  }

  const payload = {
    to: existingDraft?.to || [replyTargetForMessage(lastMessage)].filter(Boolean),
    subject: existingDraft?.subject || thread.subject || undefined,
    text: input.text,
    html: input.html || undefined,
  };

  if (existingDraft) {
    return updateDraft(existingDraft.draftId, payload);
  }

  return createDraft(threadId, {
    ...payload,
    inReplyTo: lastMessage.messageId,
    clientId: `${threadId}-draft`,
  });
}

async function getAttachment(messageId, attachmentId) {
  return agentmailRequest(
    `/v0/inboxes/${encodeURIComponent(AGENTMAIL_INBOX_ID)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
}

async function getInboxOverview(limit = 25) {
  const [threadItems, draftItems] = await Promise.all([
    listThreadItems(limit),
    listDraftItems(50),
  ]);

  const draftMap = new Map(draftItems.map((draft) => [draft.threadId, draft]));

  const threads = threadItems
    .map((threadItem) => {
      const draft = draftMap.get(threadItem.threadId) || null;
      const lastDirection = inferSummaryLastDirection(threadItem);
      const correspondent = primaryAddress(
        lastDirection === "outbound" ? threadItem.recipients : threadItem.senders
      );

      return {
        id: threadItem.threadId,
        status: draft
          ? "draft_ready"
          : lastDirection === "outbound"
            ? "awaiting_reply"
            : "open",
        subject: threadItem.subject || null,
        preview: threadItem.preview || null,
        lastMessageAt: parseTimestamp(
          threadItem.updatedAt,
          threadItem.receivedTimestamp,
          threadItem.sentTimestamp,
          threadItem.timestamp
        ),
        lastDirection,
        messageCount: threadItem.messageCount || 0,
        primaryCorrespondent: correspondent?.displayName || correspondent?.email || null,
        primaryCorrespondentEmail: correspondent?.email || null,
        hasAttachments:
          Array.isArray(threadItem.attachments) && threadItem.attachments.length > 0,
      };
    })
    .sort((a, b) => (b.lastMessageAt || "").localeCompare(a.lastMessageAt || ""));

  const summary = {
    totalThreads: threads.length,
    openThreads: threads.filter((thread) => thread.status === "open").length,
    draftReadyThreads: threads.filter((thread) => thread.status === "draft_ready").length,
    awaitingReplyThreads: threads.filter((thread) => thread.status === "awaiting_reply")
      .length,
  };

  return {
    mailbox: isConfigured()
      ? {
          provider: "agentmail",
          status: "connected",
          emailAddress: AGENTMAIL_EMAIL_ADDRESS,
          username: AGENTMAIL_INBOX_USERNAME,
          domain: AGENTMAIL_INBOX_DOMAIN,
          inboxId: AGENTMAIL_INBOX_ID,
          summary,
        }
      : null,
    threads,
  };
}

async function getInboxThreadDetail(threadId) {
  const [thread, draft] = await Promise.all([
    getThread(threadId),
    getLatestDraftForThread(threadId),
  ]);

  return {
    thread: toThreadSummary(thread, draft),
    messages: Array.isArray(thread.messages) ? thread.messages.map(toMessageDto) : [],
    draft: toDraftDto(draft),
  };
}

function isConfigured() {
  return Boolean(AGENTMAIL_API_KEY && AGENTMAIL_INBOX_ID && AGENTMAIL_EMAIL_ADDRESS);
}

function getMailboxMetadata() {
  if (!isConfigured()) {
    return null;
  }

  return {
    provider: "agentmail",
    emailAddress: AGENTMAIL_EMAIL_ADDRESS,
    username: AGENTMAIL_INBOX_USERNAME,
    domain: AGENTMAIL_INBOX_DOMAIN,
    inboxId: AGENTMAIL_INBOX_ID,
  };
}

module.exports = {
  formatAddress,
  getAttachment,
  getInboxOverview,
  getInboxThreadDetail,
  getMailboxMetadata,
  isConfigured,
  sendDraft,
  upsertThreadDraft,
};
