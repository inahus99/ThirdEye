// src/models/Incident.js
const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ONGOING", "RESOLVED"],
      default: "ONGOING",
      index: true,
    },
    errorReason: { type: String, default: null },

    // when the incident started / ended
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, default: null },
  },
  { timestamps: false }
);

// TTL: auto-delete incidents 30 days after startTime
IncidentSchema.index(
  { startTime: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, name: "ttl_incidents_start_30d" }
);

IncidentSchema.set("toJSON", { versionKey: false });
IncidentSchema.set("toObject", { versionKey: false });

module.exports = mongoose.model("Incident", IncidentSchema);
