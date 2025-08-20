// worker.js
/**
 * Background cron worker for ThirdEye
 * - Connects to Mongo (via src/services/db)
 * - Runs monitorAllSites() on a schedule
 * - Prevents overlapping runs
 * - Supports env-configurable schedule & jitter
 */

require('dotenv').config();
const cron = require('node-cron');

// Boot DB first (this file should create the mongoose connection)
require('./src/services/db');

//  monitoring function
const { monitorAllSites } = require('./src/services/monitoringService');

// ---- Config (env-overridable) ----
const SCHEDULE = process.env.CRON_SCHEDULE || '*/10 * * * *'; // every 10 min by default
const JITTER_MS = Number(process.env.CRON_JITTER_MS || '0');  // e.g. "30000" to add up to 30s jitter

// ---- Utils ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString();

// Prevent overlapping runs
let running = false;

async function runJob(trigger = 'manual') {
  if (running) {
    console.log(`[${ts()}] [worker] Skipping (${trigger}): previous run still in progress`);
    return;
  }
  running = true;

  // Optional jitter so multiple workers don't stampede at the same second
  if (JITTER_MS > 0) {
    const delay = Math.floor(Math.random() * JITTER_MS);
    console.log(`[${ts()}] [worker] Applying jitter: ${delay}ms`);
    await sleep(delay);
  }

  console.log(`[${ts()}] [worker] Running monitorAllSites() — trigger: ${trigger}`);
  try {
    const started = Date.now();
    await monitorAllSites();
    const dur = Date.now() - started;
    console.log(`[${ts()}] [worker]  Done in ${dur}ms`);
  } catch (err) {
    console.error(`[${ts()}] [worker]  Error:`, err?.message || err);
  } finally {
    running = false;
  }
}

// ---- Start up ----
console.log(`[${ts()}] 🚀 Cron worker started. Schedule="${SCHEDULE}" JITTER_MS=${JITTER_MS}`);

// 1) Run once immediately so a fresh deploy does a pass
runJob('startup').catch(() => { /* already logged */ });

// 2) Schedule recurring runs
try {
  cron.schedule(SCHEDULE, () => runJob('cron'));
  console.log(`[${ts()}] ⏱️  Cron scheduled`);
} catch (e) {
  console.error(`[${ts()}] Failed to schedule cron with "${SCHEDULE}":`, e?.message || e);
}

// 3)  shutdown
const shutdown = async (sig) => {
  console.log(`[${ts()}] 🛑 Received ${sig}. Waiting for current run to finish...`);
  // Wait briefly if a run is in progress
  const MAX_WAIT = 30_000;
  const START = Date.now();
  while (running && Date.now() - START < MAX_WAIT) {
    await sleep(500);
  }
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
