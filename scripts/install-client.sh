#!/usr/bin/env bash
set -euo pipefail

# Configure the Cloudflare Access credentials shared by the Artifact Hub
# plugins for Claude Code and Codex. Credentials are read interactively and
# are never accepted as command-line arguments or printed.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ARTIFACT_HUB_ENV_FILE:-$HOME/.zshenv}"
CLIENT_ID_VAR="ARTIFACT_HUB_ACCESS_CLIENT_ID"
CLIENT_SECRET_VAR="ARTIFACT_HUB_ACCESS_CLIENT_SECRET"

cleanup() {
  unset client_id client_secret
}
trap cleanup EXIT

read -r -p "Cloudflare Access Client ID: " client_id
read -r -s -p "Cloudflare Access Client Secret: " client_secret
printf '\n'

if [[ -z "$client_id" || -z "$client_secret" ]]; then
  echo "error: Client ID and Client Secret are required" >&2
  exit 1
fi

# Cloudflare service-token values use URL-safe identifier characters. Keeping
# this file format deliberately narrow prevents shell-code injection.
if [[ ! "$client_id" =~ ^[A-Za-z0-9._-]+$ || ! "$client_secret" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "error: credentials contain unsupported characters" >&2
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
tmp_file="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
trap 'rm -f "${tmp_file:-}"; cleanup' EXIT

awk -v id="$CLIENT_ID_VAR" -v secret="$CLIENT_SECRET_VAR" '
  $0 !~ "^[[:space:]]*export[[:space:]]+" id "=" &&
  $0 !~ "^[[:space:]]*export[[:space:]]+" secret "=" { print }
' "$ENV_FILE" > "$tmp_file"

{
  printf "export %s='%s'\n" "$CLIENT_ID_VAR" "$client_id"
  printf "export %s='%s'\n" "$CLIENT_SECRET_VAR" "$client_secret"
} >> "$tmp_file"

chmod 600 "$tmp_file"
mv "$tmp_file" "$ENV_FILE"

echo "Cloudflare Access credentials were saved to $ENV_FILE."
echo "Run 'source $ENV_FILE' before starting Codex CLI."
echo "For Codex app, add the same variables through Local Environments, then start a new thread."
echo "Claude Code marketplace: /plugin marketplace add $REPO_ROOT"
echo "Codex marketplace: codex plugin marketplace add $REPO_ROOT"
echo "After installing artifact-hub, reload Claude plugins or restart the client."
