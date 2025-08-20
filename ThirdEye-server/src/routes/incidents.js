// src/routes/incidents.js
const express = require("express");
const mongoose = require("mongoose");
const Incident = require("../models/Incident");
const Website = require("../models/Website");

const router = express.Router();

/**
 * GET /api/incidents
 * Query:
 *   - siteId (optional, ObjectId or URL)
 *   - status = ongoing|resolved (optional)
 *   - limit  (optional, default 200, max 1000)
 *
 * Returns: { ok: true, items: [{ _id, siteId, siteUrl, startedAt, endedAt, reason }] }
 */
router.get("/", async (req, res) => {
  try {
    let { siteId, status, limit = 200 } = req.query;

    // coerce limit
    limit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    // resolve siteId if URL given
    let filter = {};
    if (siteId) {
      if (mongoose.isValidObjectId(siteId)) {
        filter.site = siteId;
      } else {
        // treat as URL; resolve to _id
        const siteDoc = await Website.findOne({ url: siteId })
          .select({ _id: 1 })
          .lean();
        if (!siteDoc)
          return res.status(404).json({ ok: false, error: "site_not_found" });
        filter.site = siteDoc._id;
      }
    }

    if (status) {
      const normalized =
        status.toLowerCase() === "ongoing"
          ? "ONGOING"
          : status.toLowerCase() === "resolved"
          ? "RESOLVED"
          : null;
      if (normalized) filter.status = normalized;
    }

    // fetch incidents newest first
    const incs = await Incident.find(filter)
      .sort({ startTime: -1, startedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // collect unique site ids
    const siteIds = [...new Set(incs.map((i) => String(i.site)))];
    const sites = await Website.find({ _id: { $in: siteIds } })
      .select({ _id: 1, url: 1 })
      .lean();
    const idToUrl = new Map(sites.map((s) => [String(s._id), s.url]));

    // normalize shape for frontend
    const items = incs.map((i) => ({
      _id: i._id,
      siteId: String(i.site),
      siteUrl: idToUrl.get(String(i.site)) || "(unknown)",
      // support either naming
      startedAt: i.startedAt || i.startTime || i.createdAt || null,
      endedAt: i.endedAt || i.endTime || null,
      reason: i.reason || i.errorReason || null,
      status: i.status || (i.endedAt || i.endTime ? "RESOLVED" : "ONGOING"),
    }));

    res.json({ ok: true, items });
  } catch (e) {
    console.error("GET /api/incidents error", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
