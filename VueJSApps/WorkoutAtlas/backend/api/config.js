const express = require('express');

const router = express.Router();

// Public runtime config for frontend bootstrapping.
// Returns only the Google client ID value when configured.
router.get('/config/google', (_req, res) => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';
  const googleTestUnlinkEnabled = !isProduction && Boolean(
    String(process.env.GOOGLE_TEST_UNLINK_USER_ID || '').trim() ||
    String(process.env.GOOGLE_TEST_UNLINK_USERNAME || '').trim() ||
    String(process.env.GOOGLE_TEST_UNLINK_EMAIL || '').trim()
  );

  if (!clientId) {
    return res.status(503).json({
      clientId: null,
      googleTestUnlinkEnabled,
    });
  }

  return res.json({
    clientId,
    googleTestUnlinkEnabled,
  });
});

module.exports = router;
