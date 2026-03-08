#!/bin/bash
set -euo pipefail

# ClawStaffing — Deploy Executive Assistant Template to Customer VPS
# Usage: ./deploy-customer.sh --host <VPS_IP> --name "Jane Smith" --role "CEO" --company "Acme Inc" --timezone "America/Denver"

# ─── Parse Arguments ───────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/.."

HOST=""
INSTANCE_ID=""
CUSTOMER_NAME=""
CUSTOMER_ROLE=""
CUSTOMER_COMPANY=""
CUSTOMER_TIMEZONE="America/Denver"
USER_FILE=""
MEMORY_FILE=""
SOUL_OVERRIDE_FILE=""
GWS_CREDENTIALS_FILE=""
SSH_USER="openclaw"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -o StrictHostKeyChecking=accept-new"
GATEWAY_READY_ATTEMPTS="${GATEWAY_READY_ATTEMPTS:-12}"
GATEWAY_READY_DELAY_SECONDS="${GATEWAY_READY_DELAY_SECONDS:-5}"
RUNTIME_READY_ATTEMPTS="${RUNTIME_READY_ATTEMPTS:-12}"
RUNTIME_READY_DELAY_SECONDS="${RUNTIME_READY_DELAY_SECONDS:-5}"
SKIP_SERVICE_RESTART="${SKIP_SERVICE_RESTART:-0}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --instance-id) INSTANCE_ID="$2"; shift 2;;
    --host)       HOST="$2"; shift 2;;
    --name)       CUSTOMER_NAME="$2"; shift 2;;
    --role)       CUSTOMER_ROLE="$2"; shift 2;;
    --company)    CUSTOMER_COMPANY="$2"; shift 2;;
    --timezone)   CUSTOMER_TIMEZONE="$2"; shift 2;;
    --user-file)  USER_FILE="$2"; shift 2;;
    --memory-file) MEMORY_FILE="$2"; shift 2;;
    --soul-override-file) SOUL_OVERRIDE_FILE="$2"; shift 2;;
    --gws-credentials-file) GWS_CREDENTIALS_FILE="$2"; shift 2;;
    --ssh-user)   SSH_USER="$2"; shift 2;;
    *)            echo "Unknown option: $1"; exit 1;;
  esac
done

if [[ -z "$HOST" || -z "$CUSTOMER_NAME" ]]; then
  echo "Usage: ./deploy-customer.sh --host <VPS_IP> --name \"Jane Smith\" [--role \"CEO\"] [--company \"Acme\"] [--timezone \"America/Denver\"]"
  exit 1
fi

echo "═══════════════════════════════════════════"
echo "  ClawStaffing — Executive Assistant Deployment"
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
if [[ -n "$USER_FILE" && -f "$USER_FILE" ]]; then
  cp "$USER_FILE" "${STAGING_DIR}/workspace/USER.md"
else
  sed -i.bak \
    -e "s|\[CUSTOMER_NAME\]|${CUSTOMER_NAME}|g" \
    -e "s|\[CUSTOMER_ROLE\]|${CUSTOMER_ROLE}|g" \
    -e "s|\[CUSTOMER_COMPANY\]|${CUSTOMER_COMPANY}|g" \
    -e "s|\[CUSTOMER_TIMEZONE\]|${CUSTOMER_TIMEZONE}|g" \
    "${STAGING_DIR}/workspace/USER.md"
  rm -f "${STAGING_DIR}/workspace/USER.md.bak"
fi

# Inject name into SOUL.md greeting if present
sed -i.bak "s|\[Name\]|${CUSTOMER_NAME%% *}|g" "${STAGING_DIR}/workspace/SOUL.md"
rm -f "${STAGING_DIR}/workspace/SOUL.md.bak"

if [[ -n "$SOUL_OVERRIDE_FILE" && -f "$SOUL_OVERRIDE_FILE" ]]; then
  printf "\n\n%s\n" "$(cat "$SOUL_OVERRIDE_FILE")" >> "${STAGING_DIR}/workspace/SOUL.md"
fi

if [[ -n "$MEMORY_FILE" && -f "$MEMORY_FILE" ]]; then
  cp "$MEMORY_FILE" "${STAGING_DIR}/workspace/MEMORY.md"
fi

# ─── Step 3: Create memory directory structure ────────────────

echo "→ Creating memory structure..."
mkdir -p "${STAGING_DIR}/workspace/memory"

# ─── Step 4: Push to VPS ──────────────────────────────────────

echo "→ Pushing workspace to VPS..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "mkdir -p ~/.openclaw/workspace ~/.openclaw/skills ~/.config/gws"

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

if [[ -n "$GWS_CREDENTIALS_FILE" && -f "$GWS_CREDENTIALS_FILE" ]]; then
  echo "→ Pushing Google Workspace credentials..."
  rsync -avz --progress \
    -e "${RSYNC_SSH}" \
    "$GWS_CREDENTIALS_FILE" \
    "${SSH_USER}@${HOST}:~/.config/gws/credentials.json"
fi

# Fix permissions
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" "sudo chown -R 1000:1000 ~/.openclaw ~/.config/gws"

# ─── Step 5: Restart gateway to pick up new config ────────────

if [[ "$SKIP_SERVICE_RESTART" == "1" ]]; then
  echo "→ Skipping service restart (SKIP_SERVICE_RESTART=1)"
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  Deployment staged without restart"
  echo "═══════════════════════════════════════════"
  echo ""
  exit 0
fi

echo "→ Recreating OpenClaw services..."
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" \
  "cd ~/openclaw && docker compose up -d --force-recreate openclaw-gateway template-runtime caddy"

# ─── Step 6: Health check ─────────────────────────────────────

echo "→ Waiting for gateway to start..."
for attempt in $(seq 1 "$GATEWAY_READY_ATTEMPTS"); do
  if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" \
    "curl -sf http://127.0.0.1:18789/health >/dev/null 2>&1"; then
    echo "→ Gateway health check passed"
    break
  fi

  if [[ "$attempt" -eq "$GATEWAY_READY_ATTEMPTS" ]]; then
    echo ""
    echo "⚠️  Gateway health check failed after ${GATEWAY_READY_ATTEMPTS} attempts. Check logs:"
    echo "   ssh ${SSH_USER}@${HOST} 'cd ~/openclaw && docker compose logs --tail 50 openclaw-gateway'"
    exit 1
  fi

  echo "→ Gateway not ready yet (attempt ${attempt}/${GATEWAY_READY_ATTEMPTS}); retrying in ${GATEWAY_READY_DELAY_SECONDS}s..."
  sleep "$GATEWAY_READY_DELAY_SECONDS"
done

echo "→ Waiting for template runtime to start..."
for attempt in $(seq 1 "$RUNTIME_READY_ATTEMPTS"); do
  if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HOST}" \
    "curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1"; then
    echo "→ Template runtime health check passed"
    break
  fi

  if [[ "$attempt" -eq "$RUNTIME_READY_ATTEMPTS" ]]; then
    echo ""
    echo "⚠️  Template runtime health check failed after ${RUNTIME_READY_ATTEMPTS} attempts. Check logs:"
    echo "   ssh ${SSH_USER}@${HOST} 'cd ~/openclaw && docker compose logs --tail 50 template-runtime'"
    exit 1
  fi

  echo "→ Runtime not ready yet (attempt ${attempt}/${RUNTIME_READY_ATTEMPTS}); retrying in ${RUNTIME_READY_DELAY_SECONDS}s..."
  sleep "$RUNTIME_READY_DELAY_SECONDS"
done

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
