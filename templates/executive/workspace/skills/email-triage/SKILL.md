---
name: email-triage
description: Categorize, summarize, and draft responses for inbox management. Use when the user asks to check email, triage inbox, handle messages, or during daily briefings.
---

# Email Triage

Manage the user's inbox by categorizing, summarizing, and drafting responses.

## Process

### Step 1: Fetch Recent Emails

Use the configured email tool (gog for Gmail, himalaya for IMAP) to fetch unread emails.

```bash
# Gmail via gog
gog gmail list --unread --max 50

# Or via himalaya
himalaya list --folder INBOX --unread
```

### Step 2: Categorize Each Email

Assign every email to exactly one category:

| Category | Criteria | Action |
|----------|----------|--------|
| 🔴 **Urgent** | From VIPs (see USER.md), time-sensitive, requires decision | Flag immediately, summarize, draft response |
| 🟡 **Action Needed** | Requires a response or task but not time-critical | Summarize, suggest response or action |
| 🔵 **Informational** | FYI, newsletters worth reading, project updates | Brief one-line summary |
| ⚪ **Archive** | Marketing, automated notifications, spam, irrelevant | Archive silently, mention count only |

### Step 3: Present Summary

Format the triage as a scannable briefing:

```
📬 Inbox Triage — [count] new emails

🔴 URGENT ([count])
• [Sender] — [Subject]: [1-line summary + why it's urgent]
  → Suggested action: [response/decision needed]

🟡 ACTION NEEDED ([count])
• [Sender] — [Subject]: [1-line summary]
  → Suggested action: [what to do]

🔵 FYI ([count])
• [Sender] — [Subject]: [1-line summary]

⚪ Archived: [count] emails (marketing, notifications)
```

### Step 4: Draft Responses (When Requested)

When the user asks to respond to an email:

1. Read the full email thread for context
2. Check MEMORY.md for any history with the sender or topic
3. Draft a response matching the user's tone (see USER.md communication preferences)
4. Present the draft and wait for approval before sending

```bash
# Draft format
To: [recipient]
Subject: Re: [subject]
---
[draft body]
---
Send this? (y/n/edit)
```

## Rules

- Never send emails without explicit user approval
- Check USER.md "Email Rules" section for auto-categorization rules
- If an email is from someone in the "Always flag" list, always categorize as 🔴 Urgent
- If unsure about categorization, err toward higher priority
- Keep summaries to one line — the user can ask for more detail
- When drafting, never use "I hope this email finds you well" or similar filler
