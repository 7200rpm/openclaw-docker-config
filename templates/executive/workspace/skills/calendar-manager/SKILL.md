---
name: calendar-manager
description: Manage calendar scheduling, detect conflicts, protect focus time, and handle meeting requests. Use when the user asks about scheduling, availability, or calendar management.
---

# Calendar Manager

Handle all calendar operations — scheduling, conflict detection, availability checks, and time protection.

## Core Functions

### Check Availability

When the user or someone else needs to find open time:

```bash
# Check this week
gog calendar list --from today --to "next friday"

# Check specific date
gog calendar list --date "2026-03-15"
```

Present availability considering:
- User's working hours (USER.md)
- Existing meetings and their buffer time
- Protected focus blocks
- Travel time between in-person meetings

```
📅 AVAILABILITY — [Date Range]

[Day, Date]:
  ✅ [Time]-[Time] — Open
  ❌ [Time]-[Time] — [Meeting name]
  ✅ [Time]-[Time] — Open
  🔒 [Time]-[Time] — Focus block (protected)
```

### Handle Meeting Requests

When the user receives a meeting request or asks to schedule something:

1. Check for conflicts
2. Check against user's scheduling preferences (USER.md)
3. Present options

```
📩 MEETING REQUEST: [Subject]
From: [Organizer]
Proposed: [Date, Time, Duration]
Attendees: [List]

⚠️ Conflict: You have [existing meeting] at that time.

Options:
1. Accept (decline [existing meeting])
2. Suggest alternative: [next available slot]
3. Decline
4. Propose async (email summary instead)

What would you like to do?
```

### Schedule New Meetings

When the user wants to schedule something:

1. Identify required attendees
2. Find mutual availability (if possible via shared calendars)
3. Propose 2-3 options
4. Draft the invite (wait for approval before sending)

```bash
# Create event (only after user approval)
gog calendar create \
  --title "[Meeting name]" \
  --start "[datetime]" \
  --end "[datetime]" \
  --attendees "[email1],[email2]" \
  --description "[agenda]" \
  --location "[location or video link]"
```

### Protect Focus Time

- Never suggest scheduling over designated focus blocks unless the user explicitly asks
- If someone requests time during a focus block, suggest alternatives first
- Track how many focus hours the user actually gets each week and report in Monday briefings

### Weekly Calendar Review

On Sundays or Monday mornings, provide a week-ahead view:

```
📅 WEEK AHEAD — [Date Range]

[Day]: [X] meetings, [Y] hours of focus time
  • [Key meeting to prep for]
[Day]: [X] meetings, [Y] hours of focus time
  • [Key meeting to prep for]
...

⚠️ HEADS UP
• [Day] is packed — consider rescheduling [lowest priority meeting]
• [Recurring meeting] has no agenda set — worth canceling?
• You have [X] hours of total focus time this week (vs [Y] last week)
```

## Rules

- Never send calendar invites without explicit user approval
- Always account for the user's timezone
- Default meeting duration is 30 minutes unless specified otherwise
- Add 15-minute buffers between back-to-back meetings when possible
- For external meetings, always include a video link unless it's explicitly in-person
- If the user's day is already 80%+ booked, warn them before adding more
