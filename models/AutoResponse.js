const mongoose = require('mongoose');

const autoResponseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Auto-response name cannot exceed 50 characters']
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Auto-response message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['away', 'busy', 'vacation', 'custom'],
    default: 'away'
  },
  triggers: [{
    type: String,
    enum: ['all_messages', 'first_message', 'keywords', 'time_based'],
    default: 'all_messages'
  }],
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  timeRules: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String, // Format: "HH:MM"
      validate: {
        validator: function(v) {
          return !v || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Start time must be in HH:MM format'
      }
    },
    endTime: {
      type: String, // Format: "HH:MM"
      validate: {
        validator: function(v) {
          return !v || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'End time must be in HH:MM format'
      }
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    days: [{
      type: Number,
      min: 0,
      max: 6 // 0 = Sunday, 6 = Saturday
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  excludeContacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  onlyForContacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date
  },
  delay: {
    type: Number, // Delay in seconds before sending auto-response
    default: 0,
    min: 0,
    max: 300 // Max 5 minutes delay
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
autoResponseSchema.index({ user: 1, isActive: 1 });
autoResponseSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('AutoResponse', autoResponseSchema);
