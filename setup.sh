#!/usr/bin/env bash
# setup.sh — One-shot setup script for wa-safety-poll on Ubuntu 22.04 / 24.04
# Run as root or with sudo: sudo bash scripts/setup.sh

set -euo pipefail

PROJECT_DIR="/opt/wa-safety-poll"
SERVICE_FILE="scripts/wa-safety-poll.service"
SERVICE_DEST="/etc/systemd/system/wa-safety-poll.service"
BOT_USER="wa-bot"

echo "=== wa-safety-poll setup ==="

# --- Node.js via NodeSource (LTS) ---
echo "[1/6] Installing Node.js LTS..."
if ! command -v node &>/dev/null; then
  apt-get update -q
  apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
else
  echo "  Node.js already installed: $(node --version)"
fi

# --- Puppeteer / Chromium system dependencies ---
echo "[2/6] Installing Chromium dependencies..."
apt-get install -y \
  chromium-browser \
  libgbm-dev \
  libxshmfence-dev \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils 2>/dev/null || true

# --- Dedicated system user ---
echo "[3/6] Creating system user '${BOT_USER}'..."
if ! id "${BOT_USER}" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${BOT_USER}"
  echo "  User created."
else
  echo "  User already exists."
fi

# --- Copy project to /opt ---
echo "[4/6] Deploying project to ${PROJECT_DIR}..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$(realpath "${SCRIPT_DIR}")" != "${PROJECT_DIR}" ]; then
  cp -r "${SCRIPT_DIR}" "${PROJECT_DIR}"
fi
chown -R "${BOT_USER}:${BOT_USER}" "${PROJECT_DIR}"

# --- npm install ---
echo "[5/6] Installing Node.js dependencies..."
cd "${PROJECT_DIR}"
sudo -u "${BOT_USER}" npm install --omit=dev

# --- systemd service ---
echo "[6/6] Installing and enabling systemd service..."
cp "${PROJECT_DIR}/${SERVICE_FILE}" "${SERVICE_DEST}"
systemctl daemon-reload
systemctl enable wa-safety-poll.service

echo ""
echo "=== Setup complete ==="
echo ""
echo "NEXT STEPS:"
echo "  1. Edit /opt/wa-safety-poll/config.json — set your exact WhatsApp group name."
echo "  2. Start the service:   sudo systemctl start wa-safety-poll"
echo "  3. Watch the logs:      sudo journalctl -u wa-safety-poll -f"
echo "  4. Scan the QR code that appears in the log output with your bot WhatsApp account."
echo "  5. After successful scan the session is saved — no further QR needed unless the session expires."
echo "  6. Make the bot account a GROUP ADMIN so it can pin messages."
echo ""
echo "  To test immediately (send poll right now):"
echo "    sudo -u wa-bot node /opt/wa-safety-poll/src/bot.js --send-now"
echo ""
