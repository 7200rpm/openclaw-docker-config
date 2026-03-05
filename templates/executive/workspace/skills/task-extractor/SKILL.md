---
name: task-extractor
description: Extract action items and to-dos from emails, meeting notes, and conversations. Use when processing emails, after meetings, or when the user shares notes or transcripts.
---

# Task Extractor

Identify and capture action items from any source — emails, meeting notes, conversations, or documents.

## Trigger Conditions

- After email triage (automatically scan urgent and action-needed emails for tasks)
- User shares meeting notes or a transcript
- User says "pull tasks from this" or "what are my action items"
- After any conversation where commitments are made

## Process

### Step 1: Identify Action Items

Scan the source material for:

- Explicit asks: "Can you...", "Please...", "We need to...", "Action item:"
- Commitments made by the user: "I'll...", "I will...", "Let me...", "I can handle..."
- Commitments made by others: "[Name] will...", "[Name] agreed to..."
- Deadlines: any dates or timeframes mentioned
- Follow-ups: "Let's revisit...", "Circle back on...", "Check in next week"

### Step 2: Structure Each Task

For each action item found:

```
- **Task:** [Clear, actionable description]
- **Owner:** [User / specific person]
- **Source:** [Email from X / Meeting: Y / Conversation]
- **Deadline:** [Date if mentioned, otherwise "No deadline specified"]
- **Priority:** [Based on context and user's priorities in USER.md]
```

### Step 3: Present for Confirmation

```
📋 EXTRACTED TASKS

From: [source description]

YOUR ACTION ITEMS:
☐ [Task 1] — by [deadline]
☐ [Task 2] — by [deadline]
☐ [Task 3] — no deadline

WAITING ON OTHERS:
⏳ [Person] — [what they committed to] — by [deadline]
⏳ [Person] — [what they committed to]

Add these to your task list? (all / select / skip)
```

### Step 4: Add to Task Manager

Once confirmed, add to the user's configured task manager:

```bash
# Google Tasks via gws
gws tasks tasks insert --params '{"tasklist": "@default"}' --json '{
  "title": "[task description]",
  "due": "[ISO_DATE]",
  "notes": "Source: [email/meeting reference]"
}'

# Todoist (alternative)
todoist add "[task description]" --date "[date]" --priority [1-4]
```

Also update MEMORY.md with any "waiting on" items for future follow-up.

## Rules

- Always present extracted tasks for confirmation before adding them anywhere
- Distinguish between tasks the user owns vs tasks they're waiting on from others
- If a deadline is vague ("next week", "soon", "end of month"), convert to a specific date and note the interpretation
- Don't extract trivial items — "I'll think about it" is not a task
- When extracting from email threads, read the full thread to avoid duplicate or already-completed tasks
- Group related tasks together if they came from the same source
