const mongoose = require('mongoose');

const messageArchiveSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Archive for conversations only
  archiveType: {
    type: String,
    enum: ['conversation'],
    required: true
  },
  // For conversation archives
  otherUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  // Date range for the archived messages
  dateFrom: {
    type: Date,
    required: true
  },
  dateTo: {
    type: Date,
    required: true
  },
  // Archived messages (stored as plain objects for performance)
  messages: [{
    originalId: mongoose.Schema.Types.ObjectId,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    messageType: String,
    fileUrl: String,
    fileName: String,
    createdAt: Date,
    editedAt: Date
  }],
  messageCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
messageArchiveSchema.index({ user: 1, createdAt: -1 });
messageArchiveSchema.index({ user: 1, archiveType: 1 });
messageArchiveSchema.index({ user: 1, tags: 1 });
messageArchiveSchema.index({ user: 1, dateFrom: 1, dateTo: 1 });

module.exports = mongoose.model('MessageArchive', messageArchiveSchema);
