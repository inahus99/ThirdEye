// src/lib/config.js
const OVERRIDE_KEY = "apiUrlOverride";

export function getApiUrl() {
  const fromEnv = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;
  const fromStorage = localStorage.getItem(OVERRIDE_KEY);
  return fromStorage || fromEnv || "http://localhost:5000";
}

export function setApiOverride(url) {
  localStorage.setItem(OVERRIDE_KEY, url);
}

export function clearApiOverride() {
  localStorage.removeItem(OVERRIDE_KEY);
}
