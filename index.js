'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode                = require('qrcode-terminal');
const cron                  = require('node-cron');

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    // Target WhatsApp group name (exact match, case-sensitive)
    groupName: 'YOUR_GROUP_NAME_HERE',

    // Poll content
    poll: {
        question: 'Where is everyone?',
        options: [
            'Dubai Office',
            'Donna Tower Office',
            'Abu Dhabi',
            'Remote Work',
        ],
        allowMultipleAnswers: false,
    },

    // Cron: Monday-Friday at 06:00 GST (UTC+4)
    // node-cron runs in server local time -- see notes below
    cronSchedule: '0 6 * * 1-5',

    // Pin duration in seconds (24 hours)
    pinDuration: 86400,

    // Puppeteer / Chromium
    puppeteer: {
        executablePath: '/usr/bin/google-chrome-stable',
        userDataDir: '/opt/wa-safety-poll/.chrome-data',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        ],
    },
};

// =============================================================================
// WhatsApp client
// =============================================================================

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/opt/wa-safety-poll/.wwebjs_auth',
    }),
    puppeteer: CONFIG.puppeteer,
});

// =============================================================================
// Helpers
// =============================================================================

function log(msg) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${msg}`);
}

function todayLabel() {
    return new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        year:    'numeric',
        month:   'long',
        day:     'numeric',
        timeZone: 'Asia/Dubai',
    });
}

async function findGroup(name) {
    const chats = await client.getChats();
    const group = chats.find(c => c.isGroup && c.name === name);
    if (!group) {
        throw new Error(`Group not found: "${name}". Check CONFIG.groupName.`);
    }
    return group;
}

async function sendSafetyPoll() {
    log('Sending safety poll...');

    try {
        const group = await findGroup(CONFIG.groupName);

        const title   = `${todayLabel()}: Where is everyone?`;
        const message = await group.sendPoll(title, CONFIG.poll.options, {
            allowMultipleAnswers: CONFIG.poll.allowMultipleAnswers,
        });

        log(`Poll sent. Message ID: ${message.id._serialized}`);

        // Pin the poll message for 24 hours
        try {
            await message.pin(CONFIG.pinDuration);
            log(`Poll pinned for ${CONFIG.pinDuration / 3600} hours.`);
        } catch (pinErr) {
            // Pinning can fail if the bot is not a group admin
            log(`WARNING: Could not pin poll. Is the bot number a group admin? Error: ${pinErr.message}`);
        }

    } catch (err) {
        log(`ERROR sending poll: ${err.message}`);
    }
}

// =============================================================================
// Client events
// =============================================================================

client.on('qr', (qr) => {
    log('QR code received. Scan with WhatsApp on the bot phone:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    log('Authenticated. Session saved.');
});

client.on('auth_failure', (msg) => {
    log(`Authentication failed: ${msg}`);
    process.exit(1);
});

client.on('ready', () => {
    log('Client is ready.');
    log(`Cron schedule: "${CONFIG.cronSchedule}" (server local time)`);
    log(`Target group: "${CONFIG.groupName}"`);

    // Schedule the poll
    cron.schedule(CONFIG.cronSchedule, () => {
        log('Cron triggered.');
        sendSafetyPoll();
    });

    log('Scheduler active. Waiting for next trigger...');
});

client.on('disconnected', (reason) => {
    log(`Client disconnected: ${reason}. Exiting so systemd can restart.`);
    process.exit(1);
});

// =============================================================================
// Start
// =============================================================================

log('Initialising WhatsApp client...');
client.initialize();
