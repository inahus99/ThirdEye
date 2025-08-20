// src/controllers/websitesController.js
const Website = require("../models/Website");
const Check = require("../models/Check");

exports.getAllWebsites = async (req, res) => {
  try {
    const sites = await Website.find().sort({ url: 1 });
    res.json({ ok: true, items: sites });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.addWebsite = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });

    const exists = await Website.findOne({ url });
    if (exists) {
      return res
        .status(409)
        .json({ error: "Website already exists", site: exists });
    }

    const site = await Website.create({ url });
    res.status(201).json({ ok: true, site });
  } catch (e) {
    if (e.code === 11000) {
      const exists = await Website.findOne({ url: req.body.url });
      return res
        .status(409)
        .json({ error: "Website already exists", site: exists });
    }
    res.status(500).json({ error: e.message });
  }
};

exports.deleteWebsite = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await Website.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: "Not found" });

    // optional cleanup of related checks
    await Check.deleteMany({ site: id });

    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
