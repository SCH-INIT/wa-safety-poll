/**
 * wa-safety-poll — WhatsApp daily safety check-in bot
 *
 * Sends a poll to a configured WhatsApp group every workday at 06:00 GST (UTC+4).
 * The poll is pinned for 24 hours after posting.
 *
 * Dependencies: whatsapp-web.js, node-cron, qrcode-terminal
 */

"use strict";

const { Client, LocalAuth, Poll, MessageMedia } = require("whatsapp-web.js");
const cron = require("node-cron");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const config = require("../config.json");

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------
const LOG_DIR = path.join(__dirname, "../logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  console.log(line);
  const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(logFile, line + "\n");
}

// ---------------------------------------------------------------------------
// WhatsApp client
// ---------------------------------------------------------------------------
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, "../.wwebjs_auth") }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  log("info", "Scan the QR code below with the WhatsApp account you want to use as the bot:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => log("info", "Authenticated successfully."));

client.on("auth_failure", (msg) => {
  log("error", `Authentication failed: ${msg}`);
  process.exit(1);
});

client.on("ready", () => {
  log("info", "Client is ready. Scheduling poll job...");
  schedulePoll();
});

client.on("disconnected", (reason) => {
  log("warn", `Client disconnected: ${reason}. Attempting to reinitialise...`);
  client.initialize();
});

// ---------------------------------------------------------------------------
// Poll logic
// ---------------------------------------------------------------------------
async function sendSafetyPoll() {
  try {
    log("info", "Looking up target group...");

    const chats = await client.getChats();
    const group = chats.find(
      (c) => c.isGroup && c.name === config.groupName
    );

    if (!group) {
      log("error", `Group "${config.groupName}" not found. Check config.json → groupName.`);
      return;
    }

    // Build poll title with today's date in DD/MM/YYYY format (Dubai locale)
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Dubai",
    });

    const pollTitle = `${dateStr}: Where is everyone?`;

    const poll = new Poll(pollTitle, config.pollOptions, {
      allowMultipleAnswers: false,
    });

    log("info", `Sending poll to group "${group.name}" with title: "${pollTitle}"`);
    const sentMsg = await group.sendMessage(poll);
    log("info", `Poll sent. Message ID: ${sentMsg.id._serialized}`);

    // Pin the message for 24 hours (86400 seconds)
    // Requires the bot account to be a group admin.
    try {
      await sentMsg.pin(86400);
      log("info", "Poll pinned for 24 hours.");
    } catch (pinErr) {
      log("warn", `Could not pin the poll (bot must be group admin): ${pinErr.message}`);
    }
  } catch (err) {
    log("error", `Failed to send poll: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Scheduler — Monday–Friday at 06:00 GST (UTC+4)
// Cron runs in server local time. The systemd service sets TZ=Asia/Dubai.
// Cron expression: minute hour dom month dow
// ---------------------------------------------------------------------------
function schedulePoll() {
  // "0 6 * * 1-5" = 06:00 every Monday through Friday
  cron.schedule("0 6 * * 1-5", () => {
    log("info", "Cron triggered — sending daily safety poll.");
    sendSafetyPoll();
  }, {
    timezone: "Asia/Dubai",
  });

  log("info", "Cron job scheduled: weekdays 06:00 Asia/Dubai.");
}

// ---------------------------------------------------------------------------
// Manual trigger via CLI: node src/bot.js --send-now
// Useful for testing without waiting for the cron.
// ---------------------------------------------------------------------------
if (process.argv.includes("--send-now")) {
  log("info", "--send-now flag detected. Will send poll immediately after client is ready.");
  client.on("ready", async () => {
    await sendSafetyPoll();
    log("info", "Manual send complete. Keeping process alive for cron.");
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
log("info", "Initialising WhatsApp client...");
client.initialize();
