
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

require("./models/Website");
require("./models/Check");
require("./models/Incident");

const connectDB = require("./db");
const { setIO } = require("./services/monitoringService");

const analyticsRouter = require("./routes/analytics");
const websitesRouter = require("./routes/websites");
const cronRouter = require("./routes/cron");
const incidentsRouter = require("./routes/incidents");

// ---- process error handlers ----
process.on("unhandledRejection", (e) => console.error("UNHANDLED REJECTION", e));
process.on("uncaughtException",  (e) => console.error("UNCAUGHT EXCEPTION",  e));


(async () => {
  const app = express();

  // --- security & basics ---
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const rawOrigins = (process.env.CORS_ORIGIN || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const allowOrigin = (origin) => {
    if (!origin) return true; // Postman/curl/server-to-server
    return rawOrigins.some(rule => {
      if (rule.startsWith("https://*.")) {
        const base = rule.replace("https://*.", "");       // e.g. *.vercel.app
        return origin.endsWith(base);
      }
      return origin === rule;
    });
  };

  console.log("CORS allowlist:", rawOrigins.length ? rawOrigins : "(empty)");

  app.use(cors({
    origin(origin, cb) { cb(allowOrigin(origin) ? null : new Error(`CORS: ${origin} not allowed`), true); },
    credentials: true,
  }));

  // --- HTTP + Socket.IO ---
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, cb) { cb(allowOrigin(origin) ? null : new Error(`Socket CORS: ${origin} not allowed`), true); },
      methods: ["GET","POST"],
      credentials: true,
    },
    // path: "/socket.io"
  });
  setIO(io);

  // --- routes ---
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/websites", websitesRouter);
  app.use("/api/traffic-lite", require("./routes/trafficLite"));
  app.use("/api/cron", cronRouter);
  app.use("/api/incidents", incidentsRouter);

  // --- health & root ---
  const health = (_req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const mongoState = states[mongoose.connection.readyState] || "unknown";
    res.status(200).json({
      ok: true,
      uptime: process.uptime(),
      port: process.env.PORT || 5000,
      mongo: mongoState,
      env: process.env.NODE_ENV || "development",
    });
  };
  app.get("/health", health);
  app.get("/api/health", health);
  app.head("/health", health);
  app.head("/api/health", health);
  app.get("/", (_req, res) => res.type("text").send("Third-Eye API is running. Try /health"));

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log("process.env.PORT =", process.env.PORT);
    console.log(`Server running on port ${PORT}`);
  });

  try {
    await connectDB();
    console.log("Mongo connected");
  } catch (e) {
    console.error("Mongo connect failed:", e.message);
 
  }
})();
