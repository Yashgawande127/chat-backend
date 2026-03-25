const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'voice'],
    default: 'text'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'cancelled', 'failed'],
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
      default: 'daily'
    },
    interval: {
      type: Number,
      default: 1,
      min: 1
    },
    endDate: {
      type: Date
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6 // 0 = Sunday, 6 = Saturday
    }],
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31
    }
  },
  // File/Media specific fields for scheduled messages
  fileUrl: {
    type: String
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  thumbnailUrl: {
    type: String
  },
  duration: {
    type: Number
  },
  dimensions: {
    width: Number,
    height: Number
  },
  sentAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  nextScheduledFor: {
    type: Date // For recurring messages
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
scheduledMessageSchema.index({ sender: 1, scheduledFor: 1 });
scheduledMessageSchema.index({ status: 1, scheduledFor: 1 });
scheduledMessageSchema.index({ 'recurring.enabled': 1, status: 1 });

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
