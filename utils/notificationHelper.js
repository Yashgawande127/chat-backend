const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Send real-time notification to user if they have real-time notifications enabled
 * @param {Object} io - Socket.io instance
 * @param {String} userId - Target user ID
 * @param {Object} notificationData - Notification data
 */
const sendRealTimeNotification = async (io, userId, notificationData) => {
  try {
    // Get user with notification settings
    const user = await User.findById(userId).select('settings.notifications');
    
    if (!user || !user.settings?.notifications?.realTime) {
      console.log(`Real-time notifications disabled for user ${userId}`);
      return null;
    }

    // Create notification in database
    const notification = new Notification(notificationData);
    await notification.save();

    // Populate notification for sending
    await notification.populate('sender', 'username avatar');
    if (notification.roomId) {
      await notification.populate('roomId', 'name type');
    }

    // Send via socket to user's room
    io.to(`user_${userId}`).emit('new_notification', notification);

    console.log(`Real-time notification sent to user ${userId}`);
    return notification;
  } catch (error) {
    console.error('Error sending real-time notification:', error);
    throw error;
  }
};

/**
 * Send notification with user preference checks
 * @param {Object} io - Socket.io instance
 * @param {String} userId - Target user ID
 * @param {Object} notificationData - Notification data
 * @param {Object} options - Additional options
 */
const sendNotificationWithPreferences = async (io, userId, notificationData, options = {}) => {
  try {
    // Get user with full notification settings
    const user = await User.findById(userId).select('settings.notifications');
    
    if (!user) {
      throw new Error('User not found');
    }

    const notificationSettings = user.settings?.notifications || {};
    const { type } = notificationData;

    // Check if user wants this type of notification
    const typeSettings = {
      'message': notificationSettings.newMessages,
      'room_message': notificationSettings.newMessages,
      'room_invite': notificationSettings.roomInvites,
      'friend_request': notificationSettings.roomInvites, // Using roomInvites for friend requests
      'mention': notificationSettings.mentions,
      'reaction': notificationSettings.reactions
    };

    if (!typeSettings[type]) {
      console.log(`Notification type ${type} disabled for user ${userId}`);
      return null;
    }

    // Create notification in database
    const notification = new Notification(notificationData);
    await notification.save();

    // Populate notification
    await notification.populate('sender', 'username avatar');
    if (notification.roomId) {
      await notification.populate('roomId', 'name type');
    }

    // Send real-time notification if enabled
    if (notificationSettings.realTime) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }

    // Here you could add other notification channels:
    // - Email notifications if enabled
    // - Push notifications if enabled
    // - Desktop notifications (handled by client)

    console.log(`Notification sent to user ${userId} (real-time: ${notificationSettings.realTime})`);
    return notification;
  } catch (error) {
    console.error('Error sending notification with preferences:', error);
    throw error;
  }
};

/**
 * Check if user has notifications enabled for a specific type
 * @param {String} userId - User ID
 * @param {String} notificationType - Type of notification
 * @returns {Object} Notification preferences
 */
const getUserNotificationPreferences = async (userId, notificationType) => {
  try {
    const user = await User.findById(userId).select('settings.notifications');
    
    if (!user) {
      return { enabled: false, realTime: false };
    }

    const notifications = user.settings?.notifications || {};
    
    const typeMap = {
      'message': notifications.newMessages,
      'room_message': notifications.newMessages,
      'room_invite': notifications.roomInvites,
      'friend_request': notifications.roomInvites,
      'mention': notifications.mentions,
      'reaction': notifications.reactions
    };

    return {
      enabled: typeMap[notificationType] || false,
      realTime: notifications.realTime || false,
      desktop: notifications.desktop || false,
      sound: notifications.sound || false,
      email: notifications.email || false,
      push: notifications.push || false
    };
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    return { enabled: false, realTime: false };
  }
};

module.exports = {
  sendRealTimeNotification,
  sendNotificationWithPreferences,
  getUserNotificationPreferences
};
