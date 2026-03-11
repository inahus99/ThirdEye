const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || "fallback_secret_for_development_only";
  return jwt.sign({ id }, secret, {
    expiresIn: "30d",
  });
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Please provide email and password" });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ ok: false, error: "User already exists" });
    }

    const user = await User.create({
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        ok: true,
        user: {
          id: user._id,
          email: user.email,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ ok: false, error: "Invalid user data" });
    }
  } catch (error) {
    console.error("Register Error:", error.message);
    res.status(500).json({ ok: false, error: "Server error during registration" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

     if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Please provide email and password" });
    }

    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        ok: true,
        user: {
          id: user._id,
          email: user.email,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ ok: false, error: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ ok: false, error: "Server error during login" });
  }
});

// GET /api/auth/me (Protected - Validate token)
router.get("/me", require("../middleware/auth").requireAuth, async (req, res) => {
  res.json({
    ok: true,
    user: {
      id: req.user._id,
      email: req.user.email,
    }
  });
});

module.exports = router;
