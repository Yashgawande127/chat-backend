const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  markNotificationsRead,
  deleteNotification,
  deleteNotifications,
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

// Bulk delete notifications
router.post('/delete', auth, deleteNotifications);

// Delete notification
router.delete('/:notificationId', auth, deleteNotification);

module.exports = router;
