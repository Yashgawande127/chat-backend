const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Template name cannot exceed 50 characters']
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Template content cannot exceed 1000 characters']
  },
  category: {
    type: String,
    enum: ['greeting', 'farewell', 'business', 'personal', 'emergency', 'custom'],
    default: 'custom'
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  usageCount: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  shortcut: {
    type: String,
    trim: true,
    maxlength: [10, 'Shortcut cannot exceed 10 characters']
  }
}, {
  timestamps: true
});

// Ensure shortcuts are unique per user
messageTemplateSchema.index({ user: 1, shortcut: 1 }, { unique: true, sparse: true });
messageTemplateSchema.index({ user: 1, name: 1 });
messageTemplateSchema.index({ category: 1, isPublic: 1 });

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
