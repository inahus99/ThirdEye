// src/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB || undefined,
      autoIndex: true,
    });
    console.log(" MongoDB connected:", process.env.MONGO_URI);
  } catch (err) {
    console.error(" MongoDB connection error:", err);
    process.exit(1);
  }

  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log(" MongoDB connection closed");
    process.exit(0);
  });
};

module.exports = connectDB;
