#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKERFILE="$REPO_ROOT/docker/Dockerfile"
DEFAULT_INFRA_INPUTS="$REPO_ROOT/../openclaw-terraform-hetzner/config/inputs.sh"
ACCEPT_HEADER="application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json"

OPENCLAW_VERSION=""
RELEASE_VERSION=""
NOTES=""
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/publish-release.sh --openclaw-version <version> [options]

Required:
  --openclaw-version <version>   Upstream OpenClaw version to publish

Options:
  --release-version <version>    Managed release version (default: <openclaw>-claw.1)
  --notes <text>                 Notes to include in the release payload output
  --skip-build                   Skip image build/push and only resolve payload for an existing tag
  -h, --help                     Show this help text

Behavior:
  - Refuses to run with a dirty git worktree
  - Updates docker/Dockerfile if the OpenClaw version changed
  - Commits and pushes the config repo
  - Builds and pushes gateway + workspace-sync images
  - Resolves digest-pinned image refs for the Managed Releases UI

Examples:
  bash scripts/publish-release.sh --openclaw-version 2026.3.7
  bash scripts/publish-release.sh --openclaw-version 2026.3.7 --release-version 2026.3.7-claw.2
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --openclaw-version)
      OPENCLAW_VERSION="${2:-}"
      shift 2
      ;;
    --release-version)
      RELEASE_VERSION="${2:-}"
      shift 2
      ;;
    --notes)
      NOTES="${2:-}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$OPENCLAW_VERSION" ]] || fail "--openclaw-version is required"
RELEASE_VERSION="${RELEASE_VERSION:-${OPENCLAW_VERSION}-claw.1}"

require_cmd git
require_cmd curl
require_cmd jq
require_cmd perl

load_registry_credentials() {
  if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
    if [[ -f "$DEFAULT_INFRA_INPUTS" ]]; then
      # shellcheck disable=SC1090
      source "$DEFAULT_INFRA_INPUTS"
    fi
  fi

  [[ -n "${GHCR_USERNAME:-}" ]] || fail "GHCR_USERNAME is not set and could not be loaded from $DEFAULT_INFRA_INPUTS"
  [[ -n "${GHCR_TOKEN:-}" ]] || fail "GHCR_TOKEN is not set and could not be loaded from $DEFAULT_INFRA_INPUTS"
}

ensure_clean_worktree() {
  local status
  status="$(git -C "$REPO_ROOT" status --short)"
  if [[ -n "$status" ]]; then
    echo "$status" >&2
    fail "Git worktree is not clean. Commit or stash changes before publishing a release."
  fi
}

current_openclaw_version() {
  sed -n 's/^ARG OPENCLAW_VERSION=//p' "$DOCKERFILE"
}

update_dockerfile_version() {
  local current_version
  current_version="$(current_openclaw_version)"
  if [[ "$current_version" == "$OPENCLAW_VERSION" ]]; then
    return
  fi

  OPENCLAW_VERSION="$OPENCLAW_VERSION" perl -0pi -e 's/^ARG OPENCLAW_VERSION=.*/ARG OPENCLAW_VERSION=$ENV{OPENCLAW_VERSION}/m' "$DOCKERFILE"

  git -C "$REPO_ROOT" add docker/Dockerfile
  git -C "$REPO_ROOT" commit -m "Bump OpenClaw to $OPENCLAW_VERSION"
}

push_current_branch() {
  local branch
  branch="$(git -C "$REPO_ROOT" branch --show-current)"
  [[ -n "$branch" ]] || fail "Could not determine current git branch"
  git -C "$REPO_ROOT" push origin "$branch"
}

ghcr_token_for() {
  local image_name="$1"
  curl -fsSL \
    -u "$GHCR_USERNAME:$GHCR_TOKEN" \
    "https://ghcr.io/token?service=ghcr.io&scope=repository:${GHCR_USERNAME}/openclaw-docker-config/${image_name}:pull" \
    | jq -r '.token'
}

tag_exists() {
  local image_name="$1"
  local tag="$2"
  local token
  token="$(ghcr_token_for "$image_name")"

  curl -fsSI \
    -H "Authorization: Bearer $token" \
    -H "Accept: $ACCEPT_HEADER" \
    "https://ghcr.io/v2/${GHCR_USERNAME}/openclaw-docker-config/${image_name}/manifests/${tag}" \
    >/dev/null 2>&1
}

resolve_digest() {
  local image_name="$1"
  local tag="$2"
  local token
  local digest
  token="$(ghcr_token_for "$image_name")"

  digest="$(
    curl -fsSI \
      -H "Authorization: Bearer $token" \
      -H "Accept: $ACCEPT_HEADER" \
      "https://ghcr.io/v2/${GHCR_USERNAME}/openclaw-docker-config/${image_name}/manifests/${tag}" \
      | tr -d '\r' \
      | awk -F': ' 'tolower($1) == "docker-content-digest" { print $2; exit }'
  )"

  [[ -n "$digest" ]] || fail "Could not resolve digest for ${image_name}:${tag}"
  printf '%s\n' "$digest"
}

load_registry_credentials
ensure_clean_worktree

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  require_cmd docker
  update_dockerfile_version
  push_current_branch

  if tag_exists "openclaw-gateway" "$RELEASE_VERSION"; then
    fail "Gateway tag ${RELEASE_VERSION} already exists in GHCR. Use --release-version with a new value or rerun with --skip-build."
  fi

  if tag_exists "workspace-sync" "$RELEASE_VERSION"; then
    fail "Workspace-sync tag ${RELEASE_VERSION} already exists in GHCR. Use --release-version with a new value or rerun with --skip-build."
  fi

  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null
  GHCR_USERNAME="$GHCR_USERNAME" "$REPO_ROOT/scripts/build-and-push.sh" "$RELEASE_VERSION"
else
  if [[ "$(current_openclaw_version)" != "$OPENCLAW_VERSION" ]]; then
    fail "--skip-build requires docker/Dockerfile to already be pinned to OpenClaw ${OPENCLAW_VERSION}"
  fi
fi

CONFIG_COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
GATEWAY_DIGEST="$(resolve_digest "openclaw-gateway" "$RELEASE_VERSION")"
WORKSPACE_SYNC_DIGEST="$(resolve_digest "workspace-sync" "$RELEASE_VERSION")"
GATEWAY_IMAGE_REF="ghcr.io/${GHCR_USERNAME}/openclaw-docker-config/openclaw-gateway@${GATEWAY_DIGEST}"
WORKSPACE_SYNC_IMAGE_REF="ghcr.io/${GHCR_USERNAME}/openclaw-docker-config/workspace-sync@${WORKSPACE_SYNC_DIGEST}"
DEFAULT_NOTES="OpenClaw ${OPENCLAW_VERSION} build published from openclaw-docker-config commit ${CONFIG_COMMIT}."
NOTES="${NOTES:-$DEFAULT_NOTES}"
NOTES_JSON="$(printf '%s' "$NOTES" | jq -Rs .)"

cat <<EOF

Publish complete. Use these values in Managed Releases:

Release version:
  ${RELEASE_VERSION}

OpenClaw version:
  ${OPENCLAW_VERSION}

Gateway image ref:
  ${GATEWAY_IMAGE_REF}

Workspace sync image ref:
  ${WORKSPACE_SYNC_IMAGE_REF}

Docker config commit:
  ${CONFIG_COMMIT}

Notes:
  ${NOTES}

JSON payload:
{
  "releaseVersion": "${RELEASE_VERSION}",
  "openclawVersion": "${OPENCLAW_VERSION}",
  "gatewayImageRef": "${GATEWAY_IMAGE_REF}",
  "workspaceSyncImageRef": "${WORKSPACE_SYNC_IMAGE_REF}",
  "dockerConfigCommit": "${CONFIG_COMMIT}",
  "notes": ${NOTES_JSON}
}
EOF
