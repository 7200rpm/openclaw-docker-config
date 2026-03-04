---
name: daily-briefing
description: Generate a morning briefing with calendar, email summary, tasks, and priorities. Use when the user says good morning, asks for a briefing, or via scheduled cron job.
---

# Daily Briefing

Compile and deliver a comprehensive morning briefing covering calendar, email, tasks, and priorities.

## Trigger Conditions

- User sends a morning greeting ("good morning", "morning", "hey", "what's on today")
- Scheduled cron job (configure in cron settings for user's preferred time)
- User explicitly asks for a briefing or daily summary

## Process

### Step 1: Gather Data

Run these in parallel where possible:

```bash
# Today's calendar
gog calendar list --today

# Tomorrow's calendar (for prep)
gog calendar list --date tomorrow

# Unread emails
gog gmail list --unread --max 30

# Tasks due today (tool depends on user's task manager)
# Todoist: todoist list --filter "today"
# Google Tasks (via gog): gog tasks list
```

### Step 2: Compile Briefing

```
☀️ Good morning, [Name]. Here's your day.

📅 TODAY — [Day, Date]
[Time] [Meeting name] — [attendees, location/link]
         → Prep: [any prep notes from meeting-prep skill]
[Time] [Meeting name] — [attendees, location/link]
[Time]–[Time] Focus block (protected)

⚡ NEEDS YOUR ATTENTION
• [Urgent email/task with one-line context]
• [Decision needed on X — options: A or B]

✅ TASKS DUE TODAY
• [Task 1]
• [Task 2]

📬 INBOX SNAPSHOT
• [X] urgent, [Y] need response, [Z] FYI, [W] archived
  → [Highlight the most important 1-2 emails]

📌 REMINDERS
• [Any upcoming deadlines this week]
• [Follow-ups pending from yesterday]

👀 LOOKING AHEAD (Tomorrow)
• [Notable meetings or deadlines]
```

### Step 3: Offer Actions

After delivering the briefing, ask:

```
What would you like to tackle first?
• Reply to emails
• Prep for [next meeting]
• Review tasks
• Something else
```

## Configuration

Set the cron schedule in the cron configuration:

```json
{
  "target": "telegram:[USER_TELEGRAM_ID]",
  "every": "1d",
  "at": "07:30",
  "instructions": "Run the daily-briefing skill. Deliver the full morning briefing."
}
```

## Rules

- Always check the user's timezone (USER.md) for accurate "today"
- If it's Monday, include a brief look at the full week ahead
- If the user has a particularly heavy day, acknowledge it and suggest priority order
- Keep it scannable — the user is probably reading this on their phone over coffee
- Don't repeat information from yesterday's briefing unless it's still actionable
