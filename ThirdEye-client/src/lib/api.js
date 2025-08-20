// src/lib/api.js
const RAW_BASE = process.env.REACT_APP_API_URL || '';
const BASE = RAW_BASE.replace(/\/+$/, '');

function joinUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function qs(params = {}) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    u.append(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
}

async function handle(r) {
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) {
    const msg = body && body.error ? body.error : `${r.status} ${r.statusText}`;
    const err = new Error(msg);
    err.status = r.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  get: async (path, cfg = {}) => {
    const url = joinUrl(BASE, `/api${path}`);
    const r = await fetch(url, { method: 'GET', ...cfg });
    return handle(r);
  },
  post: async (path, body, cfg = {}) => {
    const url = joinUrl(BASE, `/api${path}`);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
      body: JSON.stringify(body ?? {}),
      ...cfg,
    });
    return handle(r);
  },

  del: async (path, cfg = {}) => {
    const url = joinUrl(BASE, `/api${path}`);
    const r = await fetch(url, {
      method: 'DELETE',
      ...(cfg || {}),
    });
    return handle(r);
  },
};
