const mongoose = require('mongoose');

const savedMessageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  messageType: {
    type: String,
    enum: ['direct', 'room'],
    required: true
  },
  // Reference to either Message or RoomMessage
  directMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  roomMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomMessage'
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  tags: [{
    type: String,
    trim: true
  }],
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Note cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
savedMessageSchema.index({ user: 1, createdAt: -1 });
savedMessageSchema.index({ user: 1, messageType: 1 });
savedMessageSchema.index({ user: 1, tags: 1 });

// Ensure user can't save the same message twice
savedMessageSchema.index({ user: 1, messageId: 1, messageType: 1 }, { unique: true });

module.exports = mongoose.model('SavedMessage', savedMessageSchema);
