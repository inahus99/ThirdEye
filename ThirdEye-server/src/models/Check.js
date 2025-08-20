const mongoose = require("mongoose");

const CheckSchema = new mongoose.Schema(
  {
    // Always reference Website by ObjectId
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["UP", "DOWN"],
      required: true,
      index: true,
    },
    // milliseconds
    responseTime: { type: Number, default: null },
  },
  // Keep only createdAt (no updatedAt)
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index (auto-delete after 30 days)
CheckSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, name: "ttl_checks_createdAt_30d" }
);

// Helpful index for queries
CheckSchema.index({ site: 1, createdAt: -1 }); // get site’s logs sorted by time

module.exports = mongoose.model("Check", CheckSchema);
