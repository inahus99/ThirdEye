// src/routes/cron.js
const express = require("express");
const {
  runAllChecks,
  runDailyAssetChecks,
  debugAsset,
} = require("../services/monitoringService");

const router = express.Router();

// GET /api/run-checks?apiKey=...
router.get("/run-checks", async (req, res) => {
  if (req.query.apiKey !== process.env.CRON_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await runAllChecks();
    res.json({ ok: true });
  } catch (e) {
    console.error("run-checks error", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// GET /api/run-daily?apiKey=...
router.get("/run-daily", async (req, res) => {
  if (req.query.apiKey !== process.env.CRON_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await runDailyAssetChecks();
    res.json({ ok: true });
  } catch (e) {
    console.error("run-daily error", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// GET /api/debug-asset?url=...
router.get("/debug-asset", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });
  try {
    const data = await debugAsset(url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

module.exports = router;
