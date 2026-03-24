#!/bin/bash

# =============================================================================
# update.sh - Update and restart the wa-safety-poll bot
# Run manually: sudo bash update.sh
# =============================================================================

set -euo pipefail

REPO_DIR="/opt/wa-safety-poll"
SERVICE_NAME="wa-safety-poll"
LOG_FILE="/var/log/wa-safety-poll-update.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
log() {
    echo "[${TIMESTAMP}] $1" | tee -a "$LOG_FILE"
}

# -----------------------------------------------------------------------------
# Ensure we're in the right place
# -----------------------------------------------------------------------------
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "ERROR: $REPO_DIR is not a git repository. Aborting."
    exit 1
fi

cd "$REPO_DIR"
log "---------------------------------------------------"
log "Update started"

# -----------------------------------------------------------------------------
# Capture state before pull
# -----------------------------------------------------------------------------
BEFORE_HASH=$(git rev-parse HEAD)
BEFORE_PKG=$(git show HEAD:package.json 2>/dev/null | md5sum || echo "none")

# -----------------------------------------------------------------------------
# Pull latest from remote
# -----------------------------------------------------------------------------
log "Pulling latest from origin/main..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

AFTER_HASH=$(git rev-parse HEAD)

if [ "$BEFORE_HASH" = "$AFTER_HASH" ]; then
    log "No changes pulled. Already up to date."
else
    log "Updated: ${BEFORE_HASH:0:8} -> ${AFTER_HASH:0:8}"
fi

# -----------------------------------------------------------------------------
# Re-run npm install if package.json changed
# -----------------------------------------------------------------------------
AFTER_PKG=$(git show HEAD:package.json 2>/dev/null | md5sum || echo "none")

if [ "$BEFORE_PKG" != "$AFTER_PKG" ]; then
    log "package.json changed. Running npm install..."
    npm install 2>&1 | tee -a "$LOG_FILE"
else
    log "package.json unchanged. Skipping npm install."
fi

# -----------------------------------------------------------------------------
# Restart the systemd service
# -----------------------------------------------------------------------------
log "Restarting service: $SERVICE_NAME..."

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl restart "$SERVICE_NAME"
    sleep 2
    STATUS=$(systemctl is-active "$SERVICE_NAME")
    log "Service status after restart: $STATUS"
    if [ "$STATUS" != "active" ]; then
        log "WARNING: Service did not come back up cleanly. Check: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi
else
    log "WARNING: systemd service '$SERVICE_NAME' not found or not enabled."
    log "If the bot isn't set up as a service yet, run the setup steps first."
fi

log "Update complete."
log "---------------------------------------------------"
