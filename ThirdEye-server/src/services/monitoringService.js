// src/services/monitoringService.js
const axios = require("axios");
const net = require("net");
const Website = require("../models/Website");
const Check = require("../models/Check");
const Incident = require("../models/Incident");

const {
  hostnameFromUrl,
  getCertInfo,
  getDomainExpirySmart,
  daysLeft,
} = require("./auxMonitors");

let io;
function setIO(instance) {
  io = instance;
}

// incident helpers
async function openIncident(siteId, reason) {
  return Incident.create({
    site: siteId,
    startTime: new Date(),
    status: "ONGOING",
    errorReason: reason || null,
  });
}

async function resolveLatestIncident(siteId) {
  return Incident.findOneAndUpdate(
    { site: siteId, endTime: null },
    { endTime: new Date(), status: "RESOLVED" },
    { sort: { startTime: -1 } }
  );
}

/** TCP dial with timeout; resolves { ok, ms, error? } */
function tcpProbe(host, port, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.createConnection({ host, port }, () => {
      const ms = Date.now() - started;
      socket.end();
      resolve({ ok: true, ms });
    });
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => {
      socket.destroy(new Error("TCP_TIMEOUT"));
    });
    socket.on("error", (err) => {
      const ms = Date.now() - started;
      resolve({
        ok: false,
        ms: null,
        error: err?.code || err?.message || "TCP_ERROR",
      });
    });
  });
}

async function httpProbe(site) {
  const started = Date.now();
  let errorReason = null;

  const {
    url,
    expectedStatus = 200,
    bodyMustContain = "",
    timeoutMs = 10000,
  } = site;

  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects: 10,
      validateStatus: () => true,
      responseType: "text",
      headers: { "User-Agent": "ThirdEye/1.0 (monitor)" },
    });

    // 1) Status assertion
    if (res.status !== expectedStatus) {
      errorReason = `HTTP ${res.status} (expected ${expectedStatus})`;
      return { up: false, ms: null, reason: errorReason };
    }

    // 2) Keyword assertion (if provided)
    if (bodyMustContain && typeof res.data === "string") {
      if (!res.data.includes(bodyMustContain)) {
        errorReason = `Keyword "${bodyMustContain}" not found`;
        return { up: false, ms: null, reason: errorReason };
      }
    }

    // passed assertions
    return { up: true, ms: Date.now() - started, reason: null };
  } catch (e) {
    errorReason = e?.code || e?.message || "HTTP_ERROR";
    return { up: false, ms: null, reason: errorReason };
  }
}

async function pingWebsite(site) {
  const prevStatus = site.status || "PENDING";

  let result;
  if (site.checkType === "TCP") {
    // TCP check
    const host = site.tcpHost;
    const port = site.tcpPort;
    const timeoutMs = site.timeoutMs || 10000;

    if (!host || !port) {
      result = { up: false, ms: null, reason: "TCP_CONFIG_MISSING" };
    } else {
      result = await tcpProbe(host, port, timeoutMs);
    }
  } else {
    // HTTP (default)
    result = await httpProbe(site);
  }

  const errorReason = result.reason || (result.up ? null : "UNKNOWN");

  // Update site
  site.status = result.up ? "UP" : "DOWN";
  site.responseTime = result.up ? result.ms : null;
  site.lastChecked = new Date();
  await site.save();

  // Record check
  await Check.create({
    site: site._id,
    status: site.status,
    responseTime: site.responseTime ?? null,
  });

  // Incidents + email
  if (prevStatus !== site.status) {
    if (site.status === "DOWN") {
      await openIncident(site._id, result.reason || "unknown");
    } else if (site.status === "UP") {
      await resolveLatestIncident(site._id);
    }
  }
  // Realtime events
  io &&
    io.emit("analytics:check", {
      site: site._id?.toString?.() || site._id,
      status: site.status,
      responseTime: site.responseTime,
      createdAt: site.lastChecked.toISOString(),
    });
  io &&
    io.emit("site:update", {
      _id: site._id?.toString?.() || site._id,
      url: site.url,
      status: site.status,
      responseTime: site.responseTime,
      lastChecked: site.lastChecked,
    });
}

async function runAllChecks() {
  const all = await Website.find();
  await Promise.all(all.map(pingWebsite));
}

/** Daily SSL + Domain sweep (unchanged) */
async function runDailyAssetChecks() {
  const sites = await Website.find();
  await Promise.all(
    sites.map(async (site) => {
      const host = hostnameFromUrl(site.url);
      if (!host) return;

      try {
        const { validTo } = await getCertInfo(host);
        site.sslValidTo = validTo || null;
        site.sslDaysLeft = validTo ? daysLeft(validTo) : null;
      } catch {
        site.sslValidTo = null;
        site.sslDaysLeft = null;
      }

      try {
        const info = await getDomainExpirySmart(host);
        site.domainRoot = info.domainRoot || null;
        site.domainSource = info.source || null;
        site.domainExpiresAt = info.domainExpiresAt || null;
        site.domainDaysLeft = info.domainDaysLeft ?? null;
      } catch {
        site.domainRoot = null;
        site.domainSource = "error";
        site.domainExpiresAt = null;
        site.domainDaysLeft = null;
      }

      await site.save();
    })
  );
}

module.exports = { setIO, pingWebsite, runAllChecks, runDailyAssetChecks };
