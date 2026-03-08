#!/bin/bash
set -euo pipefail

# ClawOps — Deploy Executive Assistant Template to Customer VPS
# Usage: ./deploy-customer.sh --host <VPS_IP> --name "Jane Smith" --role "CEO" --company "Acme Inc" --timezone "America/Denver"

# ─── Parse Arguments ───────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/.."

HOST=""
CUSTOMER_NAME=""
CUSTOMER_ROLE=""
CUSTOMER_COMPANY=""
CUSTOMER_TIMEZONE="America/Denver"
SSH_USER="openclaw"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -o StrictHostKeyChecking=accept-new"

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)       HOST="$2"; shift 2;;
    --name)       CUSTOMER_NAME="$2"; shift 2;;
    --role)       CUSTOMER_ROLE="$2"; shift 2;;
    --company)    CUSTOMER_COMPANY="$2"; shift 2;;
    --timezone)   CUSTOMER_TIMEZONE="$2"; shift 2;;
    --ssh-user)   SSH_USER="$2"; shift 2;;
    *)            echo "Unknown option: $1"; exit 1;;
  esac
done

if [[ -z "$HOST" || -z "$CUSTOMER_NAME" ]]; then
  echo "Usage: ./deploy-customer.sh --host <VPS_IP> --name \"Jane Smith\" [--role \"CEO\"] [--company \"Acme\"] [--timezone \"America/Denver\"]"
  exit 1
fi

echo "═══════════════════════════════════════════"
echo "  ClawOps — Executive Assistant Deployment"
echo "═══════════════════════════════════════════"
echo "  Host:     ${HOST}"
echo "  Customer: ${CUSTOMER_NAME}"
echo "  Role:     ${CUSTOMER_ROLE:-Not specified}"
echo "  Company:  ${CUSTOMER_COMPANY:-Not specified}"
echo "  Timezone: ${CUSTOMER_TIMEZONE}"
echo "═══════════════════════════════════════════"
echo ""

# ─── Step 1: Stage template locally ───────────────────────────

echo "→ Staging template..."
STAGING_DIR=$(mktemp -d)
trap "rm -rf ${STAGING_DIR}" EXIT

cp -r "${TEMPLATE_DIR}/workspace" "${STAGING_DIR}/workspace"
cp -r "${TEMPLATE_DIR}/config" "${STAGING_DIR}/config"

# ─── Step 2: Inject customer details into USER.md ─────────────

echo "→ Personalizing USER.md..."
sed -i.bak \
  -e "s|\[CUSTOMER_NAME\]|${CUSTOMER_NAME}|g" \
  -e "s|\[CUSTOMER_ROLE\]|${CUSTOMER_ROLE}|g" \
  -e "s|\[CUSTOMER_COMPANY\]|${CUSTOMER_COMPANY}|g" \
  -e "s|\[CUSTOMER_TIMEZONE\]|${CUSTOMER_TIMEZONE}|g" \
  "${STAGING_DIR}/workspace/USER.md"
rm -f "${STAGING_DIR}/workspace/USER.md.bak"

# Inject name into SOUL.md greeting if present
sed -i.bak "s|\[Name\]|${CUSTOMER_NAME%% *}|g" "${STAGING_DIR}/workspace/SOUL.md"
rm -f "${STAGING_DIR}/workspace/SOUL.md.bak"

# ─── Step 3: Create memory directory structure ────────────────

echo "→ Creating memory structure..."
mkdir -p "${STAGING_DIR}/workspace/memory"

# ─── Step 4: Push to VPS ──────────────────────────────────────

echo "→ Pushing workspace to VPS..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "mkdir -p ~/.openclaw/workspace ~/.openclaw/skills"

# Push workspace files (skills, memory, personality)
rsync -avz --progress \
  -e "${RSYNC_SSH}" \
  "${STAGING_DIR}/workspace/" \
  "${SSH_USER}@${HOST}:~/.openclaw/workspace/"

# Push config files (openclaw.json)
rsync -avz --progress \
  -e "${RSYNC_SSH}" \
  "${STAGING_DIR}/config/" \
  "${SSH_USER}@${HOST}:~/.openclaw/"

# Fix permissions
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "sudo chown -R 1000:1000 ~/.openclaw"

# ─── Step 5: Restart gateway to pick up new config ────────────

echo "→ Restarting OpenClaw gateway..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "cd ~/openclaw && docker compose restart openclaw-gateway"

# ─── Step 6: Health check ─────────────────────────────────────

echo "→ Waiting for gateway to start..."
sleep 5

HEALTH=$(ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" \
  "curl -sf http://127.0.0.1:18789/health 2>/dev/null || echo 'FAILED'")

if [[ "$HEALTH" == "FAILED" ]]; then
  echo ""
  echo "⚠️  Gateway health check failed. Check logs:"
  echo "   ssh ${SSH_USER}@${HOST} 'cd ~/openclaw && docker compose logs --tail 50 openclaw-gateway'"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Deployment complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Push .env with API keys:  make push-env  (from infra repo)"
echo "  2. Point DNS to the VPS IP:  ${HOST}"
echo "  3. Deploy containers:        make deploy"
echo "  4. Pair messaging channel:   message the bot with /start"
echo "  5. Run onboarding call with ${CUSTOMER_NAME}"
echo ""
echo "  Dashboard:"
echo "  HTTPS:  https://<customer-hostname>  (after DNS + Caddy TLS)"
echo "  Tunnel: make tunnel → http://localhost:18789"
echo ""
