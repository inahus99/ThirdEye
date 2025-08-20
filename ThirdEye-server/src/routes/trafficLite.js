const router = require('express').Router();

router.get('/_ping', (req, res) => {
  res.json({ ok: true, t: Date.now() });
});

router.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
