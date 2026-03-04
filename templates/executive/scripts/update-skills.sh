#!/bin/bash
set -euo pipefail

# ClawOps — Push skill updates to a running customer instance
# Usage: ./update-skills.sh --host <VPS_IP> [--skill email-triage]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="${SCRIPT_DIR}/../templates/executive/workspace/skills"
SSH_USER="openclaw"
HOST=""
SPECIFIC_SKILL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)    HOST="$2"; shift 2;;
    --skill)   SPECIFIC_SKILL="$2"; shift 2;;
    --ssh-user) SSH_USER="$2"; shift 2;;
    *)         echo "Unknown option: $1"; exit 1;;
  esac
done

if [[ -z "$HOST" ]]; then
  echo "Usage: ./update-skills.sh --host <VPS_IP> [--skill <skill-name>]"
  exit 1
fi

if [[ -n "$SPECIFIC_SKILL" ]]; then
  echo "→ Pushing skill: ${SPECIFIC_SKILL}"
  rsync -avz "${SKILLS_DIR}/${SPECIFIC_SKILL}/" \
    "${SSH_USER}@${HOST}:~/.openclaw/workspace/skills/${SPECIFIC_SKILL}/"
else
  echo "→ Pushing all skills..."
  rsync -avz "${SKILLS_DIR}/" \
    "${SSH_USER}@${HOST}:~/.openclaw/workspace/skills/"
fi

ssh "${SSH_USER}@${HOST}" "sudo chown -R 1000:1000 ~/.openclaw/workspace/skills"

echo "✅ Skills updated. Changes will take effect on the next session."
echo "   (OpenClaw watches skill folders by default — no restart needed.)"
