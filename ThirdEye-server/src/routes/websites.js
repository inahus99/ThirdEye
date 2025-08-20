// src/routes/websites.js
const express = require("express");
const Website = require("../models/Website");
const { pingWebsite } = require("../services/monitoringService");

const router = express.Router();

// GET all websites
router.get("/", async (_req, res) => {
  try {
    const sites = await Website.find().sort({ updatedAt: -1 }).lean();
    res.json({ ok: true, items: sites });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to fetch websites" });
  }
});

// POST add a new website
router.post("/", async (req, res) => {
  try {
    const {
      url = "",
      checkType = "HTTP",
      expectedStatus = 200,
      bodyMustContain = "",
      tcpHost = "",
      tcpPort = null,
      timeoutMs = 10000,
    } = req.body || {};

    // minimal validation
    if (checkType === "HTTP") {
      if (!url)
        return res
          .status(400)
          .json({ ok: false, error: "url is required for HTTP check" });
    } else if (checkType === "TCP") {
      if (!tcpHost || !tcpPort) {
        return res
          .status(400)
          .json({
            ok: false,
            error: "tcpHost and tcpPort are required for TCP check",
          });
      }
    } else {
      return res.status(400).json({ ok: false, error: "invalid checkType" });
    }

    // idempotency for HTTP url
    if (checkType === "HTTP") {
      const exists = await Website.findOne({ url }).lean();
      if (exists)
        return res
          .status(409)
          .json({ ok: false, error: "Website already exists", site: exists });
    }

    const site = await Website.create({
      url: url || null,
      checkType,
      expectedStatus,
      bodyMustContain,
      tcpHost,
      tcpPort,
      timeoutMs,
      status: "PENDING",
    });

    res.status(201).json({ ok: true, item: site });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to create website" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    [
      "url",
      "checkType",
      "expectedStatus",
      "bodyMustContain",
      "tcpHost",
      "tcpPort",
      "timeoutMs",
    ].forEach((k) => {
      if (k in req.body) updates[k] = req.body[k];
    });

    const site = await Website.findByIdAndUpdate(id, updates, { new: true });
    if (!site)
      return res.status(404).json({ ok: false, error: "Site not found" });
    res.json({ ok: true, item: site });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to update website" });
  }
});

// DELETE a website
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Website.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to delete website" });
  }
});

// POST /api/websites/:id/check-now
router.post("/:id/check-now", async (req, res) => {
  try {
    const { id } = req.params;
    const site = await Website.findById(id);
    if (!site)
      return res.status(404).json({ ok: false, error: "Site not found" });

    await pingWebsite(site);
    const fresh = await Website.findById(id).lean();
    res.json({ ok: true, item: fresh });
  } catch (e) {
    console.error("check-now error:", e);
    res.status(500).json({ ok: false, error: "check_now_failed" });
  }
});

module.exports = router;
