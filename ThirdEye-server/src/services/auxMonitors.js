// src/services/auxMonitors.js
const tls = require("tls");
const net = require("net");
const { parse } = require("tldts");

const KNOWN_PROVIDER_ROOTS = new Set([
  "vercel.app",
  "netlify.app",
  "github.io",
  "surge.sh",
  "render.com",
  "herokuapp.com",
  "cloudfront.net",
  "pages.dev",
  "firebaseapp.com",
  "web.app",
]);

const KNOWN_SOURCES = new Set([
  "whois",
  "rdap",
  "provider",
  "api",
  "manual",
  "error",
  "none",
  "fallback",
]);

/** ---- WHOIS rate-limit + cache knobs (env-tunable) ---- */
const RATE_LIMIT_MS = parseInt(process.env.WHOIS_RATE_LIMIT_MS || "2500", 10); // min gap
const CACHE_TTL_MS = parseInt(
  process.env.WHOIS_CACHE_TTL_MS || `${12 * 60 * 60 * 1000}`,
  10
); // 12h

/** In-memory cache + single-flight tracking */
const whoisCache = new Map(); // domainRoot -> { data, expiresAt }
const inflight = new Map(); // domainRoot -> Promise
let lastWhoisAt = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Extract hostname from URL */
function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Return the registered domain (eTLD+1) */
function getDomainRoot(hostname) {
  if (!hostname) return null;
  const info = parse(hostname, { detectIp: true });
  if (info.isIp) return null; // IPs don’t have a domain root
  return info.domain || null;
}

/** Days left helper */
function daysLeft(dateLike) {
  if (!dateLike) return null;
  const ts = new Date(dateLike).getTime();
  if (Number.isNaN(ts)) return null;
  const diff = ts - Date.now();
  return Math.max(0, Math.round(diff / (24 * 3600e3)));
}

/** TLS: read certificate (validTo) by opening a TLS socket to host:443 */
async function getCertInfo(host, { timeoutMs = 8000 } = {}) {
  if (!host) throw new Error("no_host");

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) return resolve({ validTo: null });
          resolve({ validTo: new Date(cert.valid_to) });
        } catch (e) {
          reject(e);
        }
      }
    );
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("tls_timeout"));
    });
    socket.on("error", reject);
  });
}

/** WHOIS lookup via IANA → referred server (best-effort) */
async function whoisRaw(domain, { timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(
      { host: "whois.iana.org", port: 43 },
      () => {
        client.write(`${domain}\r\n`);
      }
    );

    let data = "";
    client.setTimeout(timeoutMs, () => {
      client.destroy();
      reject(new Error("whois_timeout"));
    });
    client.on("data", (chunk) => (data += chunk.toString("utf8")));
    client.on("error", reject);
    client.on("end", () => {
      const m = data.match(/whois:\s*(\S+)/i);
      const server = m ? m[1].trim() : null;
      if (!server) return resolve({ server: null, text: data });

      const c2 = net.createConnection({ host: server, port: 43 }, () => {
        c2.write(`${domain}\r\n`);
      });
      let d2 = "";
      c2.setTimeout(timeoutMs, () => {
        c2.destroy();
        resolve({ server, text: data });
      });
      c2.on("data", (ch) => (d2 += ch.toString("utf8")));
      c2.on("error", () => resolve({ server, text: data }));
      c2.on("end", () => resolve({ server, text: d2 || data }));
    });
  });
}

/** Parse common expiry fields from WHOIS blob */
function parseWhoisExpiry(text) {
  if (!text) return null;
  const patterns = [
    /Registry Expiry Date:\s*([0-9T:\-\.Z ]+)/i,
    /Registrar Registration Expiration Date:\s*([0-9T:\-\.Z ]+)/i,
    /Expiration Date:\s*([0-9T:\-\.Z ]+)/i,
    /Expiry Date:\s*([0-9T:\-\.Z ]+)/i,
    /Expiration Time:\s*([0-9T:\-\.Z ]+)/i,
    /renewal date:\s*([0-9T:\-\.Z ]+)/i,
    /paid-till:\s*([0-9\.\-: T]+)/i, // .ru style
    /expires:\s*([0-9\.\-: T]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const val = m[1].trim();
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d;
      const d2 = new Date(val + "Z");
      if (!Number.isNaN(d2.getTime())) return d2;
    }
  }
  return null;
}

/** RDAP fallback: JSON over HTTPS via rdap.org proxy */
async function fetchRdapExpiry(domain, { timeoutMs = 7000 } = {}) {
  try {
    const axios = require("axios");
    const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
    const { data } = await axios.get(url, { timeout: timeoutMs });
    if (data && Array.isArray(data.events)) {
      const ev = data.events.find(
        (e) => /expire|expiration/i.test(e.eventAction || "") && e.eventDate
      );
      if (ev) {
        const d = new Date(ev.eventDate);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    if (data && data.notAfter) {
      const d = new Date(data.notAfter);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch (_e) {}
  return null;
}

/** Normalize source into a small stable set */
function normalizeDomainSource(input) {
  if (!input) return null;
  const s = String(input).toLowerCase().trim();
  return KNOWN_SOURCES.has(s) ? s : "other";
}

/** ---- Rate-limited + cached WHOIS wrapper (single-flight) ---- */
async function rateLimitedWhois(domainRoot) {
  // Cache hit?
  const hit = whoisCache.get(domainRoot);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data; // { server, text, expiry }
  }

  // If already in flight, share the same promise
  const existing = inflight.get(domainRoot);
  if (existing) return existing;

  const p = (async () => {
    // Enforce min gap between WHOIS queries (global)
    const since = Date.now() - lastWhoisAt;
    const wait = Math.max(0, RATE_LIMIT_MS - since);
    if (wait > 0) await sleep(wait);

    // Real query
    lastWhoisAt = Date.now();
    const raw = await whoisRaw(domainRoot);
    const expiry = parseWhoisExpiry(raw.text);

    const data = {
      server: raw.server || null,
      text: raw.text || "",
      expiry: expiry || null,
    };
    whoisCache.set(domainRoot, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  })();

  inflight.set(domainRoot, p);
  try {
    const res = await p;
    return res;
  } finally {
    inflight.delete(domainRoot);
  }
}

/**
 * Smart domain expiry:
 * - derive eTLD+1
 * - skip WHOIS for known provider roots
 * -  WHOIS (rate-limited & cached) → then RDAP
 */
async function getDomainExpirySmart(hostname) {
  const domainRoot = getDomainRoot(hostname);
  if (!domainRoot) {
    return {
      domainRoot: null,
      source: "none",
      domainExpiresAt: null,
      domainDaysLeft: null,
    };
  }

  if (KNOWN_PROVIDER_ROOTS.has(domainRoot)) {
    return {
      domainRoot,
      source: "provider",
      domainExpiresAt: null,
      domainDaysLeft: null,
    };
  }

  // WHOIS (rate-limited + cached)
  try {
    const { expiry } = await rateLimitedWhois(domainRoot);
    if (expiry) {
      return {
        domainRoot,
        source: "whois",
        domainExpiresAt: expiry,
        domainDaysLeft: daysLeft(expiry),
      };
    }
  } catch (_e) {
    // fall through to RDAP
  }

  // RDAP fallback
  const rdapExpiry = await fetchRdapExpiry(domainRoot).catch(() => null);
  if (rdapExpiry) {
    return {
      domainRoot,
      source: "rdap",
      domainExpiresAt: rdapExpiry,
      domainDaysLeft: daysLeft(rdapExpiry),
    };
  }

  return {
    domainRoot,
    source: "error",
    domainExpiresAt: null,
    domainDaysLeft: null,
  };
}

function _whoisCacheStats() {
  return { size: whoisCache.size };
}
function _clearWhoisCache() {
  whoisCache.clear();
}

module.exports = {
  hostnameFromUrl,
  getDomainRoot,
  KNOWN_PROVIDER_ROOTS,
  KNOWN_SOURCES,
  getCertInfo,
  whoisRaw,
  parseWhoisExpiry,
  fetchRdapExpiry,
  getDomainExpirySmart,
  normalizeDomainSource,
  daysLeft,
  // testing helpers
  _whoisCacheStats,
  _clearWhoisCache,
};
