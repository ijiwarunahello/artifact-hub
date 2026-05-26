#!/usr/bin/env bash
set -euo pipefail

# Install the artifact-hub LaunchAgent so the server auto-starts at login.
# Usage: ./scripts/install-launchagent.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.ijiwarunahello.artifact-hub"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/.artifact-hub/logs"
NODE_BIN="$(command -v node)"

mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$PLIST")"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_ROOT}/dist/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ARTIFACT_HUB_HOST</key><string>0.0.0.0</string>
    <key>ARTIFACT_HUB_PUBLIC_HOST</key><string>127.0.0.1</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_DIR}/out.log</string>
  <key>StandardErrorPath</key><string>${LOG_DIR}/err.log</string>
</dict>
</plist>
PLIST

echo "wrote $PLIST"
echo "launchctl unload \"$PLIST\" 2>/dev/null || true"
echo "launchctl load \"$PLIST\""
