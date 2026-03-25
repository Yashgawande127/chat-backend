const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  markNotificationsRead,
  deleteNotification,
  getUnreadCount
} = require('../controllers/notificationController');

// Get all notifications for authenticated user
router.get('/', auth, getNotifications);

// Get unread count
router.get('/unread-count', auth, getUnreadCount);

// Mark all notifications as read
router.patch('/mark-all-read', auth, markAllAsRead);

// Mark context notifications as read
router.patch('/read', auth, markNotificationsRead);

// Mark notification as read
router.patch('/:notificationId/read', auth, markAsRead);

// Delete notification
router.delete('/:notificationId', auth, deleteNotification);

module.exports = router;
