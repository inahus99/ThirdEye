const jwt = require("jsonwebtoken");
const User = require("../models/User");

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET || "fallback_secret_for_development_only";
    const decoded = jwt.verify(token, secret);
    
    // Attach user to request
    const user = await User.findById(decoded.id).select("-password -__v");
    if (!user) {
      return res.status(401).json({ ok: false, error: "Unauthorized: Invalid user" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid or expired token" });
  }
};

module.exports = { requireAuth };
