# 📍 wa-safety-poll

> *Because "is everyone okay?" deserves a better answer than radio silence.*

A WhatsApp bot that posts a daily safety poll to a company group every weekday morning at **06:00 GST (UTC+4)**. Team members indicate where they're working from with a single tap. The poll is pinned for 24 hours so nobody has to scroll to find it.

Built for the Dubai office. Born out of necessity. Running on a Linux server so it never forgets, even when you do.

---

## 🗺️ How It Works

```
06:00 GST, Mon-Fri
      │
      ▼
  node-cron fires
      │
      ▼
whatsapp-web.js sends poll to group
      │
      ▼
Poll pinned for 24 hours
      │
      ▼
Everyone clicks. You sleep better.
```

The bot runs as a `systemd` service under a locked-down `wabot` system account. It authenticates to WhatsApp once via QR code scan and saves the session locally. After that it's fully autonomous.

---

## 📋 Poll Format

**Title:** `Monday, 24 March 2026: Where is everyone?`

**Options (single choice):**
- Dubai Office
- Donna Tower Office
- Abu Dhabi
- Remote Work

---

## 🖥️ Server Requirements

| What | Version |
|------|---------|
| OS | Ubuntu 24.04 LTS |
| Node.js | v22.x (LTS) |
| Browser | Google Chrome Stable (non-snap) |
| Systemd | Yes (standard on Ubuntu) |
| Timezone | Asia/Dubai |

---

## 📁 File Layout

```
/opt/wa-safety-poll/          ← application root (owned by wabot)
├── index.js                  ← the bot
├── update.sh                 ← pull from git and restart service
├── package.json
├── .npmrc                    ← npm cache path config
├── .puppeteerrc.cjs          ← tells Puppeteer to use system Chrome
├── node_modules/
├── .wwebjs_auth/             ← WhatsApp session data (700, wabot only)
└── .chrome-data/             ← Chrome user data dir (700, wabot only)

/var/log/wa-safety-poll-update.log   ← update.sh log
/etc/systemd/system/wa-safety-poll.service
/etc/sudoers.d/wa-safety-poll
```

---

## 🚀 Fresh Server Setup

> Do this once. Then forget about it and let it run.

### 1. Create the bot system user

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin wabot
sudo mkdir -p /home/wabot
sudo chown wabot:wabot /home/wabot
sudo chmod 700 /home/wabot
sudo usermod -d /home/wabot wabot
```

> Chrome needs a home directory even for headless runs. Yes, really. No, we can't skip it.

### 2. Install Node.js 22 (LTS)

```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 3. Install Google Chrome (non-snap)

```bash
curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
  | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
  http://dl.google.com/linux/chrome/deb/ stable main" \
  | sudo tee /etc/apt/sources.list.d/google-chrome.list

sudo apt update && sudo apt install -y google-chrome-stable
google-chrome-stable --version
```

> Do not use the snap version of Chromium. It refuses to run without a real home directory and will waste an afternoon you'll never get back.

### 4. Create the application directory

```bash
sudo mkdir -p /opt/wa-safety-poll
sudo chown wabot:wabot /opt/wa-safety-poll
sudo chmod 750 /opt/wa-safety-poll
sudo usermod -aG wabot $USER
newgrp wabot
```

### 5. Clone the repo

```bash
cd /opt
sudo -u wabot git clone https://github.com/YOUR_USERNAME/wa-safety-poll.git
```

### 6. Install dependencies

```bash
cd /opt/wa-safety-poll
sudo -u wabot PUPPETEER_SKIP_DOWNLOAD=true npm install --cache /opt/wa-safety-poll/.npm-cache
```

### 7. Create required directories

```bash
sudo mkdir -p /opt/wa-safety-poll/.wwebjs_auth
sudo chown wabot:wabot /opt/wa-safety-poll/.wwebjs_auth
sudo chmod 700 /opt/wa-safety-poll/.wwebjs_auth

sudo mkdir -p /opt/wa-safety-poll/.chrome-data
sudo chown wabot:wabot /opt/wa-safety-poll/.chrome-data
sudo chmod 700 /opt/wa-safety-poll/.chrome-data

sudo touch /var/log/wa-safety-poll-update.log
sudo chown wabot:wabot /var/log/wa-safety-poll-update.log
sudo chmod 640 /var/log/wa-safety-poll-update.log
```

### 8. Configure the bot

Edit `index.js` and set the group name:

```bash
sudo -u wabot nano /opt/wa-safety-poll/index.js
```

Change:
```js
groupName: 'YOUR_GROUP_NAME_HERE',
```

To the exact name of your WhatsApp group, character for character, including any emoji if the group name has one.

### 9. Set server timezone

```bash
sudo timedatectl set-timezone Asia/Dubai
timedatectl
```

### 10. Install the systemd service

```bash
sudo nano /etc/systemd/system/wa-safety-poll.service
```

Paste:

```ini
[Unit]
Description=WhatsApp Safety Poll Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=wabot
Group=wabot
WorkingDirectory=/opt/wa-safety-poll
ExecStart=/usr/bin/node /opt/wa-safety-poll/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wa-safety-poll
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable wa-safety-poll
```

### 11. Allow passwordless update runs

```bash
sudo visudo -f /etc/sudoers.d/wa-safety-poll
```

Add (replace `youruser` with your actual Linux username):

```
youruser ALL=(ALL) NOPASSWD: /opt/wa-safety-poll/update.sh
```

---

## 📱 First-Time WhatsApp Authentication

> You do this once per bot number. The session is saved and survives reboots.

**Before you start:** the bot number must be a **dedicated WhatsApp account on a physical SIM**. Virtual/VoIP numbers are rejected by WhatsApp at registration. A used human account may get its session revoked immediately. A fresh number is the only reliable option. Yes, it costs AED 25-50 at Carrefour. Yes, it's worth it.

Run the bot manually so you can see the QR code:

```bash
sudo -u wabot node /opt/wa-safety-poll/index.js
```

1. A QR code appears in the terminal
2. Open WhatsApp on the bot phone
3. Go to **Settings > Linked Devices > Link a Device**
4. Scan the QR code
5. Wait for the terminal to show:

```
[...] Authenticated. Session saved.
[...] Client is ready.
[...] Scheduler active. Waiting for next trigger...
```

6. Hit `Ctrl+C`
7. Start the service properly:

```bash
sudo systemctl start wa-safety-poll
sudo systemctl status wa-safety-poll
```

Also make the bot number a **group admin** in WhatsApp, otherwise poll pinning will fail silently.

---

## 🔧 Day-to-Day Operations

### Check service status
```bash
sudo systemctl status wa-safety-poll
```

### View live logs
```bash
journalctl -u wa-safety-poll -f
```

### Restart the service
```bash
sudo systemctl restart wa-safety-poll
```

### Deploy an update from git
```bash
sudo bash /opt/wa-safety-poll/update.sh
```

### View update history
```bash
cat /var/log/wa-safety-poll-update.log
```

---

## 🔁 Re-authentication (if the session expires)

This happens if WhatsApp revokes the linked device, or if the bot number gets a new phone.

```bash
sudo systemctl stop wa-safety-poll
sudo rm -rf /opt/wa-safety-poll/.wwebjs_auth/session
sudo rm -rf /opt/wa-safety-poll/.chrome-data/*
sudo -u wabot node /opt/wa-safety-poll/index.js
```

Scan the QR code, wait for "Client is ready", then `Ctrl+C` and restart the service.

---

## ⚙️ Configuration Reference

All config lives at the top of `index.js` in the `CONFIG` object:

| Key | Default | Description |
|-----|---------|-------------|
| `groupName` | *(set this)* | Exact WhatsApp group name, case-sensitive |
| `poll.question` | `Where is everyone?` | Poll question body |
| `poll.options` | 4 location options | Edit freely, max 12 options |
| `poll.allowMultipleAnswers` | `false` | Single choice enforced |
| `cronSchedule` | `0 6 * * 1-5` | Mon-Fri 06:00 server local time |
| `pinDuration` | `86400` | Seconds to pin (86400 = 24h) |
| `puppeteer.executablePath` | `/usr/bin/google-chrome-stable` | Path to Chrome binary |

---

## ⚠️ Known Limitations

- **WhatsApp ToS:** `whatsapp-web.js` is unofficial. Meta does not endorse it. For an internal safety tool with low message volume, ban risk is minimal but not zero.
- **Pinning requires admin:** the bot number must be a group admin or pinning fails silently (the poll still gets sent).
- **Session lifespan:** WhatsApp occasionally revokes linked device sessions, especially after long inactivity or WhatsApp app updates on the bot phone. See re-authentication steps above.
- **Virtual numbers don't work:** WhatsApp blocks VoIP numbers at registration. Use a physical SIM.

---

## 🆘 Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `LOGOUT` on startup | Session revoked remotely | Re-authenticate |
| `Group not found` error | Wrong group name in config | Check `CONFIG.groupName`, exact match required |
| Poll sends but doesn't pin | Bot not a group admin | Promote bot number to admin in WhatsApp |
| Chrome fails to launch | Wrong executable path | Check `CONFIG.puppeteer.executablePath` with `which google-chrome-stable` |
| Service won't start | Port/permission issue | Check `journalctl -u wa-safety-poll -n 50` |
| Poll not firing at 6am | Server timezone wrong | `timedatectl` should show `Asia/Dubai` |

---

*Last updated: March 2026*
