// src/index.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const incidentsRouter = require("./routes/incidents");

require("./models/Website");
require("./models/Check");
require("./models/Incident");

const connectDB = require("./db");
const { setIO } = require("./services/monitoringService");

const analyticsRouter = require("./routes/analytics");
const websitesRouter = require("./routes/websites");
const cronRouter = require("./routes/cron");

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION", err);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION", err);
  process.exit(1);
});

(async () => {
  const app = express();
  await connectDB();

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const rawOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const originAllowlist = new Set(rawOrigins);
  console.log(
    " CORS allowlist:",
    originAllowlist.size ? [...originAllowlist] : "(empty)"
  );

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // Postman/curl
        if (originAllowlist.has(origin)) return cb(null, true);
        return cb(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );

  // --- HTTP + Socket.IO ---
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (originAllowlist.has(origin)) return cb(null, true);
        return cb(new Error(`Socket.IO CORS: Origin ${origin} not allowed`));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  setIO(io);

  // --- API routes (mount AFTER CORS) ---
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/websites", websitesRouter);
app.use('/api/traffic-lite', require('./routes/trafficLite'));
  app.use("/api", cronRouter);
  app.use("/api/incidents", require("./routes/incidents"));
  
app.use('/api/cron', cronRoutes);  
  // health + root …
  const PORT = process.env.PORT || 5000;
  const health = (_req, res) => {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const mongoState = states[mongoose.connection.readyState] || "unknown";
    res
      .status(200)
      .json({
        ok: true,
        uptime: process.uptime(),
        port: PORT,
        mongo: mongoState,
        env: process.env.NODE_ENV || "development",
      });
  };
  app.get("/health", health);
  app.get("/api/health", health);
  app.head("/health", health);
  app.head("/api/health", health);

  app.get("/", (_req, res) => {
    res
      .type("text")
      .send(
        "Third-Eye API is running. Try /health or /api/health or /api/websites"
      );
  });

  server.listen(PORT, () => console.log(` Server running on port ${PORT}`));
})();
