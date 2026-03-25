const mongoose = require('mongoose');

const messageReminderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Reminder message cannot exceed 200 characters']
  },
  reminderFor: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: ['follow_up', 'birthday', 'meeting', 'deadline', 'custom'],
    default: 'custom'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'dismissed', 'snoozed'],
    default: 'pending'
  },
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'yearly'
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  snoozeUntil: {
    type: Date
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  nextReminderDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
messageReminderSchema.index({ user: 1, reminderFor: 1 });
messageReminderSchema.index({ status: 1, reminderFor: 1 });
messageReminderSchema.index({ user: 1, status: 1, reminderFor: 1 });

module.exports = mongoose.model('MessageReminder', messageReminderSchema);
