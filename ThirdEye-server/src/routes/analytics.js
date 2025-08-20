// src/routes/analytics.js
const express = require("express");
const dayjs = require("dayjs");
const mongoose = require("mongoose");

const Website = require("../models/Website");
const Check = require("../models/Check");

const router = express.Router();

/* --------------------------- helpers --------------------------- */

// Normalize URL: lowercases protocol+host and trims trailing slash
function normalizeUrl(input) {
  if (!input || typeof input !== "string") return input;
  const trimmed = input.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    const proto = u.protocol.toLowerCase();
    const host = u.host.toLowerCase();
    return `${proto}//${host}${u.pathname}${u.search}${u.hash}`.replace(
      /\/+$/,
      ""
    );
  } catch {
    return trimmed;
  }
}

// Resolve a site by id or url → return Website _id as string (or null)
async function resolveSiteId(idOrUrl) {
  if (!idOrUrl) return null;
  if (mongoose.isValidObjectId(idOrUrl)) return idOrUrl;

  const site = await Website.findOne({ url: normalizeUrl(idOrUrl) })
    .select({ _id: 1 })
    .lean();

  return site ? String(site._id) : null;
}

// Safe int parsing with upper bound
function parseCappedInt(v, fallback, cap) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 0), cap);
}

/* ----------------------------- routes ----------------------------- */

router.get("/overview", async (req, res) => {
  try {
    const hours = parseCappedInt(req.query.hours, 24, 168);
    const since = new Date(Date.now() - hours * 3600e3);

    const [siteCount, totalChecks, upChecks] = await Promise.all([
      Website.countDocuments(),
      Check.countDocuments({ createdAt: { $gte: since } }),
      Check.countDocuments({ createdAt: { $gte: since }, status: "UP" }),
    ]);

    const uptimePercent =
      totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : null;

    const perSite = await Check.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$site",
          total: { $sum: 1 },
          up: { $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] } },
          latestStatus: { $first: "$status" },
          latestAt: { $first: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          siteId: "$_id",
          total: 1,
          up: 1,
          latestStatus: 1,
          latestAt: 1,
          uptimePercent: {
            $cond: [
              { $gt: ["$total", 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ["$up", "$total"] }, 100] },
                  0,
                ],
              },
              null,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      ok: true,
      since,
      hours,
      websites: siteCount,
      checks: totalChecks,
      upCount: upChecks,
      uptimePercent,
      perSite,
    });
  } catch (err) {
    console.error("GET /overview error", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

router.get("/checks", async (req, res) => {
  try {
    const { siteId, limit = 100, before } = req.query;
    if (!siteId) return res.status(400).json({ error: "siteId required" });

    const resolved = await resolveSiteId(siteId);
    if (!resolved) return res.status(404).json({ error: "site not found" });

    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);

    const where = { site: resolved };
    if (before) {
      const dt = new Date(before);
      if (!isNaN(dt.getTime())) where.createdAt = { $lt: dt };
      else if (mongoose.isValidObjectId(before)) where._id = { $lt: before };
    }

    const checks = await Check.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .limit(lim + 1) // overfetch to see if there's a next page
      .lean();

    const hasMore = checks.length > lim;
    const page = hasMore ? checks.slice(0, lim) : checks;
    const nextCursor = hasMore ? page[page.length - 1]?.createdAt : null;

    res.json({ items: page, nextCursor, hasMore });
  } catch (err) {
    console.error("GET /checks error", err);
    res.status(500).json({ error: "server_error" });
  }
});
/**
 * GET /api/analytics/uptime?siteId=...&hours=24
 * { since, hours, upCount, total, uptimePercent }
 */
router.get("/uptime", async (req, res) => {
  try {
    const { siteId, hours = 24 } = req.query;
    if (!siteId) return res.status(400).json({ error: "siteId required" });

    const resolved = await resolveSiteId(siteId);
    if (!resolved) return res.status(404).json({ error: "site not found" });

    const hrs = parseCappedInt(hours, 24, 168);
    const since = new Date(Date.now() - hrs * 3600e3);

    const [upCount, total] = await Promise.all([
      Check.countDocuments({
        site: resolved,
        createdAt: { $gte: since },
        status: "UP",
      }),
      Check.countDocuments({ site: resolved, createdAt: { $gte: since } }),
    ]);

    const uptimePercent =
      total > 0 ? Math.round((upCount / total) * 100) : null;

    res.json({ since, hours: hrs, upCount, total, uptimePercent });
  } catch (err) {
    console.error("GET /uptime error", err);
    res.status(500).json({ error: "server_error" });
  }
});

/**
 * GET /api/analytics/uptime-hourly?siteId=...&hours=24
 * RETURNS [{ hour: "HH:00", percent }]
 */
router.get("/uptime-hourly", async (req, res) => {
  try {
    const { siteId, hours = 24 } = req.query;
    if (!siteId) return res.status(400).json({ error: "siteId required" });

    const resolved = await resolveSiteId(siteId);
    if (!resolved) return res.status(404).json({ error: "site not found" });

    const hrs = parseCappedInt(hours, 24, 168);
    const now = new Date();
    const start = new Date(now.getTime() - hrs * 3600e3);

    const checks = await Check.find({
      site: resolved,
      createdAt: { $gte: start },
    }).lean();

    const buckets = {};
    for (let i = 0; i <= hrs; i++) {
      const dt = new Date(start.getTime() + i * 3600e3);
      const label = dayjs(dt).format("HH:00");
      buckets[label] = { up: 0, total: 0 };
    }

    for (const c of checks) {
      const label = dayjs(c.createdAt).format("HH:00");
      if (!buckets[label]) continue;
      buckets[label].total++;
      if (c.status === "UP") buckets[label].up++;
    }

    const hourly = Object.entries(buckets).map(([hour, { up, total }]) => ({
      hour,
      percent: total ? Math.round((up / total) * 100) : null,
    }));

    res.json(hourly);
  } catch (err) {
    console.error("GET /uptime-hourly error", err);
    res.status(500).json({ error: "server_error" });
  }
});

module.exports = router;
