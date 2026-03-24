# wa-safety-poll

A lightweight Node.js bot that posts a daily safety check-in poll to a WhatsApp group every workday (Monday–Friday) at **06:00 Gulf Standard Time (UTC+4)**.

The poll asks team members to indicate where they are working from. After posting, the bot attempts to pin the message for 24 hours automatically.

---

## How it works

- The bot connects to WhatsApp using a dedicated phone number via [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), which drives a headless Chromium browser simulating WhatsApp Web.
- A cron job triggers every weekday morning at 06:00 Asia/Dubai.
- The poll is sent to the configured group as a native WhatsApp poll (single-choice).
- The bot then pins the poll for 24 hours. **This requires the bot account to be a group admin.**
- The bot runs as a systemd service and restarts automatically if it crashes.

### Poll format

```
[DD/MM/YYYY]: Where is everyone?
  ○ Dubai Office
  ○ Donna Tower Office
  ○ Abu Dhabi
  ○ Remote Work
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| OS | Ubuntu 22.04 LTS or 24.04 LTS |
| Node.js | v18 or later (installed by setup script) |
| RAM | 512 MB minimum (Chromium is the main consumer) |
| WhatsApp number | A dedicated SIM or virtual number — **not a personal number** |
| Group admin | The bot number must be made a group admin for pinning to work |

---

## Project structure

```
wa-safety-poll/
├── src/
│   └── bot.js               Main bot logic, cron scheduler, poll sender
├── scripts/
│   ├── setup.sh             One-shot setup script (run as root)
│   └── wa-safety-poll.service  systemd unit file
├── logs/                    Auto-created at runtime, one log file per day
├── .wwebjs_auth/            Auto-created — WhatsApp session data (do not delete)
├── config.json              Bot configuration (edit before first run)
├── package.json
├── .gitignore
└── README.md
```

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_ORG/wa-safety-poll.git
cd wa-safety-poll
```

### Step 2 — Edit config.json

Open `config.json` and set the `groupName` to the **exact** name of your WhatsApp group, character for character:

```json
{
  "groupName": "Company Safety Check-in",
  "pollOptions": [
    "Dubai Office",
    "Donna Tower Office",
    "Abu Dhabi",
    "Remote Work"
  ]
}
```

> The group name must match exactly — including capitalisation and spaces. You can verify the name by opening WhatsApp on your phone and checking the group header.

### Step 3 — Run the setup script

```bash
sudo bash scripts/setup.sh
```

This script:
- Installs Node.js LTS via NodeSource
- Installs all Chromium system dependencies
- Creates a dedicated unprivileged system user `wa-bot`
- Copies the project to `/opt/wa-safety-poll`
- Runs `npm install`
- Installs and enables the systemd service (does **not** start it yet)

### Step 4 — Start the service and scan the QR code

```bash
sudo systemctl start wa-safety-poll
sudo journalctl -u wa-safety-poll -f
```

Within a few seconds you will see a QR code printed in the log output.

1. Open WhatsApp on the **bot phone** (the dedicated spare number).
2. Go to **Settings → Linked Devices → Link a Device**.
3. Scan the QR code shown in the terminal.

Once authenticated, the log will show:

```
[INFO] Authenticated successfully.
[INFO] Client is ready. Scheduling poll job...
[INFO] Cron job scheduled: weekdays 06:00 Asia/Dubai.
```

The session is saved to `.wwebjs_auth/` on disk. You will not need to scan again unless WhatsApp invalidates the session (which can happen if the phone app is logged out remotely).

### Step 5 — Make the bot a group admin

On any admin's phone:
1. Open the WhatsApp group.
2. Tap the group name → Participants.
3. Tap the bot's number → Make group admin.

This is required for pinning to work. The poll will still be sent even without admin rights, but it will not be pinned.

---

## Testing — send the poll immediately

To verify everything works without waiting until 06:00:

```bash
sudo -u wa-bot node /opt/wa-safety-poll/src/bot.js --send-now
```

Check the group on your phone. The poll should appear and be pinned within a few seconds.

---

## Service management

| Action | Command |
|---|---|
| Start | `sudo systemctl start wa-safety-poll` |
| Stop | `sudo systemctl stop wa-safety-poll` |
| Restart | `sudo systemctl restart wa-safety-poll` |
| Status | `sudo systemctl status wa-safety-poll` |
| Live logs | `sudo journalctl -u wa-safety-poll -f` |
| Logs today | `sudo journalctl -u wa-safety-poll --since today` |

Log files are also written to `/opt/wa-safety-poll/logs/YYYY-MM-DD.log`.

---

## Updating the bot

```bash
cd /opt/wa-safety-poll
sudo systemctl stop wa-safety-poll
sudo -u wa-bot git pull
sudo -u wa-bot npm install --omit=dev
sudo systemctl start wa-safety-poll
```

---

## Changing the poll options or group name

1. Edit `/opt/wa-safety-poll/config.json`
2. Restart the service: `sudo systemctl restart wa-safety-poll`

No re-authentication needed.

---

## Troubleshooting

### QR code never appears
- Check that Chromium dependencies are installed: `chromium-browser --version`
- Check logs: `sudo journalctl -u wa-safety-poll -f`
- Confirm the service is running as user `wa-bot` and the `/opt/wa-safety-poll` directory is owned by that user

### Group not found
- The error `Group "..." not found` means the group name in `config.json` does not exactly match the WhatsApp group name
- Double-check for trailing spaces, emoji, or different capitalisation

### Poll is sent but not pinned
- The bot number is not a group admin. Follow Step 5 above
- Pinning is also silently blocked by WhatsApp in some cases. The poll still works normally even without pinning

### Session expired / QR code appears again
- This happens if someone logs out the bot's linked device remotely, or if WhatsApp forces re-authentication
- Simply scan the QR code again as in Step 4
- To prevent this: do not use the bot's phone number actively for other chats

### High CPU or memory on first run
- Chromium initialises on first launch and can briefly spike. This is normal and settles within 30–60 seconds

---

## Security notes

- The bot number's WhatsApp session is stored in `/opt/wa-safety-poll/.wwebjs_auth/`. This directory should not be committed to Git (it is in `.gitignore`) and should not be readable by other users.
- The bot runs under the dedicated unprivileged user `wa-bot` with no login shell.
- whatsapp-web.js is an unofficial library. Meta's ToS prohibit automation of personal accounts. Use a dedicated number, keep the bot's behaviour non-spammy (one message per day), and you are unlikely to encounter issues in practice. There is no guarantee against a number ban, which is why using a spare number rather than a personal one is essential.

---

## Maintenance calendar

| Task | Frequency | Notes |
|---|---|---|
| Check service status | Weekly | `systemctl status wa-safety-poll` |
| Review log files | Monthly | `/opt/wa-safety-poll/logs/` |
| Update dependencies | Quarterly | `npm audit` then `npm update` |
| Verify QR session active | Monthly | Check that polls are still arriving |

---

## License

Internal use only.
