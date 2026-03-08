# ClawStaffing — Executive Assistant Template

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

### System Tools
| Tool | Purpose |
|------|---------|
| `gws` | [Google Workspace CLI](https://github.com/googleworkspace/cli) — Gmail, Calendar, Tasks, Drive, Sheets, Docs, Chat |
| `gh` | GitHub CLI — issues, PRs, CI |

### ClawHub Skills (from manifest)
| Skill | Purpose |
|-------|---------|
| `memory-setup` | Persistent memory configuration |
| `yt` | YouTube transcript fetching |
| `agent-browser` | Headless browser for web research |
| `conventional-commits` | Format commit messages properly |
| `github` | GitHub integration |

## Google Workspace Integration

The executive template uses the [Google Workspace CLI (`gws`)](https://github.com/googleworkspace/cli) for Gmail, Calendar, Tasks, Drive, Sheets, and Docs access. It's installed globally in the Docker image via npm.

### Authentication Setup

`gws` requires OAuth authentication with the customer's Google account. Two approaches:

**Option A: Interactive (if customer has browser access to the VPS)**
```bash
# SSH into customer VPS and run inside the gateway container
docker exec -it openclaw-gateway gws auth setup
# This opens a browser for Google OAuth consent
```

**Option B: Headless (typical for managed VPS)**
1. Auth on a machine with a browser:
   ```bash
   gws auth login
   ```
2. Export credentials:
   ```bash
   gws auth export --unmasked > gws-credentials.json
   ```
3. Transfer to customer VPS:
   ```bash
   scp gws-credentials.json deploy@<VPS_IP>:/tmp/
   ```
4. Import inside the gateway container:
   ```bash
   docker exec -i openclaw-gateway sh -c 'cat > /home/node/.config/gws/credentials.json' < /tmp/gws-credentials.json
   ```

**Option C: Service Account (for domain-wide delegation)**
```bash
# Set env var in .env file on customer VPS
GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/home/node/.config/gws/service-account.json
```

### Supported Services
- **Gmail** — list, search, read, send, draft emails
- **Calendar** — list events, create/update/delete, free/busy queries
- **Tasks** — list, create, complete tasks
- **Drive** — list, upload, download, share files
- **Sheets** — read/write spreadsheet data
- **Docs** — read/create documents
- **Chat** — send messages to Spaces

All commands return structured JSON, making them ideal for AI agent parsing.

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

1. **Push model API keys** — `make push-env` from the infra repo with their `MINIMAX_API_KEY`
   MiniMax uses an Anthropic-compatible API format and endpoint, but the credential is still a MiniMax-issued key.
2. **Pair messaging channel** — Have them message the Telegram/WhatsApp bot with `/start`
3. **Fill in USER.md** — Walk through their preferences, priorities, and key contacts during the onboarding call
4. **Configure Google Workspace** — Set up `gws` auth with their Google account (see Authentication Setup above)
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
clawstaffing-executive/
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
