#!/usr/bin/env bash
set -euo pipefail

# Install agent clients (Claude Code plugin + Codex config snippet) locally.
# Usage:
#   ./scripts/install-client.sh claude-code
#   ./scripts/install-client.sh codex
#   ./scripts/install-client.sh all

TARGET="${1:-all}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_claude_code() {
  local marketplaces="$HOME/.claude/plugins/marketplaces"
  mkdir -p "$marketplaces"
  ln -sfn "$REPO_ROOT" "$marketplaces/artifact-hub"
  echo "linked Claude Code marketplace: $marketplaces/artifact-hub -> $REPO_ROOT"
  echo "next steps inside Claude Code:"
  echo "  /plugin marketplace add $marketplaces/artifact-hub"
  echo "  /plugin install artifact-hub@artifact-hub"
}

install_codex() {
  local cfg="$HOME/.codex/config.toml"
  mkdir -p "$(dirname "$cfg")"
  touch "$cfg"
  if grep -q "\[mcp_servers.artifact_hub\]" "$cfg"; then
    echo "[mcp_servers.artifact_hub] already present in $cfg — skipping append"
  else
    {
      echo ""
      cat "$REPO_ROOT/clients/codex/config-snippet.toml"
    } >> "$cfg"
    echo "appended [mcp_servers.artifact_hub] to $cfg"
  fi

  local agents_dir="$HOME/.codex"
  local agents_md="$agents_dir/AGENTS.md"
  if [ -f "$agents_md" ] && grep -q "artifact_hub" "$agents_md"; then
    echo "AGENTS.md already references artifact_hub — skipping"
  else
    {
      echo ""
      echo "## Artifact Hub"
      echo "See $REPO_ROOT/clients/codex/AGENTS.md for usage guide."
    } >> "$agents_md"
    echo "noted artifact_hub in $agents_md"
  fi
}

case "$TARGET" in
  claude-code) install_claude_code ;;
  codex) install_codex ;;
  all) install_claude_code; install_codex ;;
  *) echo "usage: $0 <claude-code|codex|all>" >&2; exit 1 ;;
esac

if curl -fs "http://127.0.0.1:27183/api/health" >/dev/null 2>&1; then
  echo "✓ server is running"
else
  echo "! server not detected on :27183 — run 'npm run build && npm start' or the LaunchAgent installer first"
fi
