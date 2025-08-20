// src/lib/socket.js
import { io } from "socket.io-client";

const BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

export const socket = io(BASE, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  withCredentials: true,
  autoConnect: true,
});

//  dev logs
socket.on("connect", () => console.log("[socket] connected", socket.id));
socket.on("disconnect", (r) => console.log("[socket] disconnected", r));
socket.on("connect_error", (err) =>
  console.warn("[socket] connect_error", err?.message || err)
);
