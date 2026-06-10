const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  sendNotification,
  getNotificationLogs,
} = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.put('/:id/read', protect, markAsRead);
router.put('/read-all', protect, markAllAsRead);
router.post('/send', protect, authorize('admin'), sendNotification);
router.get('/logs', protect, authorize('admin'), getNotificationLogs);

module.exports = router;
