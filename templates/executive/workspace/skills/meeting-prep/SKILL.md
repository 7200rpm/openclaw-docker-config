---
name: meeting-prep
description: Prepare briefing materials before meetings. Use when user asks to prep for a meeting, before scheduled meetings, or when reviewing upcoming calendar events.
---

# Meeting Prep

Research and compile context before meetings so the user walks in prepared.

## Trigger Conditions

- User asks "prep me for my [meeting name]" or "what do I need to know for my [time] meeting"
- Can be triggered automatically 15-30 minutes before meetings via cron
- During daily briefing when a meeting needs prep

## Process

### Step 1: Get Meeting Details

```bash
# Get specific meeting details
gog calendar get --event "[meeting name or ID]"
```

Extract: title, time, attendees, location/link, description, any attached documents.

### Step 2: Gather Context

For each attendee and topic:

1. **Check memory** — Read MEMORY.md for any history with attendees or the topic
2. **Check recent emails** — Search for email threads related to the meeting topic or with attendees
   ```bash
   gog gmail search "from:[attendee email] OR to:[attendee email]" --max 10
   gog gmail search "[meeting topic keywords]" --max 10
   ```
3. **Check previous meetings** — Look for notes from prior meetings with the same group
4. **Check tasks** — Any open action items related to this meeting or these people

### Step 3: Compile Prep Brief

```
🎯 MEETING PREP: [Meeting Name]
📅 [Time] | [Duration] | [Location/Link]

👥 ATTENDEES
• [Name] — [Role/Company] | [Last interaction: date, topic]
• [Name] — [Role/Company] | [New contact — no history]

📋 CONTEXT
[2-3 sentences on what this meeting is about, based on calendar description and email threads]

💬 LAST TIME WE MET
[Summary of previous meeting with this group, key decisions, open items]

⚠️ OPEN ITEMS
• [Action item you owe them]
• [Action item they owe you]

📎 RELEVANT THREADS
• [Email subject] — [1-line summary, date]
• [Email subject] — [1-line summary, date]

💡 SUGGESTED TALKING POINTS
1. [Based on open items and context]
2. [Based on recent developments]
3. [Based on user's current priorities from USER.md]
```

### Step 4: Post-Meeting

After the meeting time has passed, prompt the user:

```
Your [meeting name] should be wrapping up. Any notes or action items to capture?
```

If the user provides notes, extract action items and:
- Add tasks to their task manager
- Update MEMORY.md with key decisions
- Draft any follow-up emails (present for approval)

## Rules

- For recurring meetings, reference notes from the last occurrence
- If no context is found, say so honestly — "No prior history with [person]" is more useful than padding
- Keep the prep brief to what fits on one phone screen
- Prioritize actionable context over background information
- If the meeting is with an external party, search the web for recent news about their company
