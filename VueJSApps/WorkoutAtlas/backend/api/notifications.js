const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');

const requireLoggedInUser = (req, res, next) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  return next();
};

router.get('/notifications/unread-count', requireLoggedInUser, notificationsController.getUnreadCount.bind(notificationsController));
router.get('/notifications', requireLoggedInUser, notificationsController.listNotifications.bind(notificationsController));
router.post('/notifications/read', requireLoggedInUser, notificationsController.markRead.bind(notificationsController));

// Backward-compatible endpoints retained for existing clients.
router.patch('/notifications/mark-all-read', requireLoggedInUser, (req, res) => {
  req.body = { ...(req.body || {}), markAll: true };
  return notificationsController.markRead(req, res);
});
router.patch('/notifications/:id/read', requireLoggedInUser, (req, res, next) => {
  req.body = { notificationId: req.params.id };
  return notificationsController.markRead(req, res, next);
});

// Optional helper for internal/admin workflows.
router.post('/notifications', requireLoggedInUser, notificationsController.createFromRequest.bind(notificationsController));

module.exports = router;
