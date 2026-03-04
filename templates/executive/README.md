# ClawOps — Executive Assistant Template

Prebaked OpenClaw configuration for knowledge workers who need email triage, calendar management, daily briefings, and task extraction.

## What's Included

### Workspace Files
| File | Purpose |
|------|---------|
| `SOUL.md` | Assistant personality — direct, proactive, protective of time |
| `USER.md` | Customer profile template (filled during onboarding) |
| `MEMORY.md` | Structured long-term memory (populated over time) |
| `AGENTS.md` | Agent behavior rules and confirmation requirements |
| `CLAUDE.md` | Shared instructions for session startup and safety |

### Custom Skills
| Skill | What It Does |
|-------|-------------|
| `email-triage` | Categorize, summarize, and draft responses for inbox management |
| `daily-briefing` | Morning summary with calendar, emails, tasks, and priorities |
| `meeting-prep` | Gather context and compile briefing materials before meetings |
| `task-extractor` | Pull action items from emails, meetings, and conversations |
| `calendar-manager` | Scheduling, conflict detection, availability, time protection |

### ClawHub Skills (from manifest)
| Skill | Purpose |
|-------|---------|
| `gog` | Google Workspace integration (Gmail, Calendar, Tasks, Drive) |
| `memory-setup` | Persistent memory configuration |
| `yt` | YouTube transcript fetching |
| `agent-browser` | Headless browser for web research |
| `system-monitor` | Server health monitoring |

## Deployment

### Prerequisites
- VPS provisioned via the infra repo (`openclaw-terraform-hetzner`)
- OpenClaw Docker container running on the VPS
- SSH access to the VPS

### Deploy to a new customer
```bash
chmod +x scripts/deploy-customer.sh
./scripts/deploy-customer.sh \
  --host 168.119.xx.xx \
  --name "Jane Smith" \
  --role "VP of Operations" \
  --company "Acme Inc" \
  --timezone "America/New_York"
```

### Push skill updates to existing customer
```bash
# Update all skills
./scripts/update-skills.sh --host 168.119.xx.xx

# Update a single skill
./scripts/update-skills.sh --host 168.119.xx.xx --skill email-triage
```

## Post-Deployment Onboarding

After deploying, complete these steps with the customer:

1. **Push API keys** — `make push-env` from the infra repo with their Anthropic key
2. **Pair messaging channel** — Have them message the Telegram/WhatsApp bot with `/start`
3. **Fill in USER.md** — Walk through their preferences, priorities, and key contacts during the onboarding call
4. **Configure email access** — Set up `gog` with their Google account (OAuth flow)
5. **Set up daily briefing cron** — Configure timing based on their morning routine
6. **Test each skill** — Send a test email, check calendar, run a briefing
7. **Adjust SOUL.md** — Tweak tone and behavior based on their feedback

## Customization Per Customer

Files you'll typically customize per customer:
- `USER.md` — Always (filled during onboarding)
- `SOUL.md` — Sometimes (if they want a different tone)
- `openclaw.json` — Rarely (model choice, tool permissions)
- `skills/` — Per-customer additions as needed

## Directory Structure
```
clawops-executive/
├── workspace/
│   ├── CLAUDE.md
│   ├── SOUL.md
│   ├── USER.md
│   ├── AGENTS.md
│   ├── MEMORY.md
│   └── skills/
│       ├── email-triage/SKILL.md
│       ├── daily-briefing/SKILL.md
│       ├── meeting-prep/SKILL.md
│       ├── task-extractor/SKILL.md
│       └── calendar-manager/SKILL.md
├── config/
│   ├── openclaw.json
│   └── skills-manifest.txt
├── scripts/
│   ├── deploy-customer.sh
│   └── update-skills.sh
└── README.md
```
