const mongoose = require("mongoose");

// Normalize URL: trim & drop trailing slashes
function normalizeUrl(input) {
  if (!input || typeof input !== "string") return input;
  const trimmed = input.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}${u.pathname}${u.search}${u.hash}`.replace(
      /\/+$/,
      ""
    );
  } catch {
    return trimmed;
  }
}

const websiteSchema = new mongoose.Schema(
  {
    // May be empty for TCP checks
    url: {
      type: String,
      required: false,
      trim: true,
      set: normalizeUrl,
    },

    // Check configuration
    checkType: {
      type: String,
      enum: ["HTTP", "TCP"],
      default: "HTTP",
      index: true,
    },

    // HTTP-only assertions
    expectedStatus: { type: Number, default: 200 }, // e.g. 200, 301, 403
    bodyMustContain: { type: String, default: "" }, // empty = no body assertion

    // TCP-only config
    tcpHost: { type: String, default: "" }, // e.g. "127.0.0.1" or "db.example.com"
    tcpPort: { type: Number, default: null }, // e.g. 5432
    timeoutMs: { type: Number, default: 10000 },

    // Computed status
    status: {
      type: String,
      enum: ["UP", "DOWN", "PENDING"],
      default: "PENDING",
      index: true,
    },
    responseTime: { type: Number, default: null },
    lastChecked: { type: Date, default: null },

    // SSL
    sslValidTo: { type: Date, default: null },
    sslDaysLeft: { type: Number, default: null },
    sslCheckedAt: { type: Date, default: null },

    // Domain / WHOIS
    domainExpiresAt: { type: Date, default: null },
    domainDaysLeft: { type: Number, default: null },
    domainRoot: { type: String, default: null },
    domainSource: {
      type: String,
      enum: [
        null,
        "whois",
        "provider",
        "rdap",
        "error",
        "none",
        "fallback",
        "other",
      ],
      default: null,
    },
    domainCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Validation: enforce required fields by checkType
websiteSchema.path("checkType").validate(function () {
  if (this.checkType === "HTTP") {
    return !!this.url; // must have URL
  }
  if (this.checkType === "TCP") {
    return !!this.tcpHost && typeof this.tcpPort === "number";
  }
  return true;
}, "Invalid configuration for selected check type.");

// Helpful indexes
websiteSchema.index({ updatedAt: -1 });

// Clean output
websiteSchema.set("toJSON", { versionKey: false });
websiteSchema.set("toObject", { versionKey: false });

module.exports = mongoose.model("Website", websiteSchema);
