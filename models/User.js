const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  interests: [{
    type: String,
    trim: true,
    maxlength: [50, 'Interest cannot exceed 50 characters']
  }],
  profileTheme: {
    background: {
      type: String,
      default: '#4f46e5' // Default gradient color
    },
    accentColor: {
      type: String,
      default: '#6366f1'
    },
    backgroundImage: {
      type: String,
      default: null
    },
    backgroundType: {
      type: String,
      enum: ['color', 'gradient', 'image'],
      default: 'gradient'
    }
  },
  badges: [{
    type: {
      type: String,
      enum: ['early_adopter', 'verified', 'premium', 'contributor', 'moderator', 'achievement'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: '#10b981'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  verification: {
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    },
    verificationType: {
      type: String,
      enum: ['email', 'phone', 'manual'],
      default: 'email'
    }
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  contacts: {
    friends: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        default: 'pending'
      },
      addedAt: {
        type: Date,
        default: Date.now
      },
      acceptedAt: {
        type: Date
      }
    }],
    favorites: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    blocked: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      blockedAt: {
        type: Date,
        default: Date.now
      },
      reason: {
        type: String,
        maxlength: [200, 'Block reason cannot exceed 200 characters']
      }
    }]
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      desktop: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      realTime: { type: Boolean, default: true },
      newMessages: { type: Boolean, default: true },
      roomInvites: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      reactions: { type: Boolean, default: true }
    },
    account: {
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'America/New_York' },
      autoSave: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true },
      onlineStatus: { type: Boolean, default: true },
      profileVisibility: { 
        type: String, 
        enum: ['public', 'friends', 'private'], 
        default: 'public' 
      }
    },
    chat: {
      fontSize: { 
        type: String, 
        enum: ['small', 'medium', 'large', 'extra-large'], 
        default: 'medium' 
      },
      enterToSend: { type: Boolean, default: true },
      showTypingIndicator: { type: Boolean, default: true },
      groupMessagesByDate: { type: Boolean, default: true },
      messagePreview: { type: Boolean, default: true },
      autoDownload: { 
        type: String, 
        enum: ['always', 'wifi', 'never'], 
        default: 'wifi' 
      }
    },
    customTheme: {
      name: { type: String, default: 'default' },
      primary: { type: String, default: '#3b82f6' },
      secondary: { type: String, default: '#1e40af' },
      accent: { type: String, default: '#06b6d4' },
      background: { type: String, default: '#ffffff' },
      surface: { type: String, default: '#f8fafc' },
      text: { type: String, default: '#1f2937' },
      textSecondary: { type: String, default: '#6b7280' },
      isCustom: { type: Boolean, default: false }
    },
    chatCustomization: {
      bubbleStyle: { 
        type: String, 
        enum: ['rounded', 'square', 'minimal', 'bubble'], 
        default: 'rounded' 
      },
      bubbleColors: {
        sent: { type: String, default: '#3b82f6' },
        received: { type: String, default: '#e5e7eb' },
        sentText: { type: String, default: '#ffffff' },
        receivedText: { type: String, default: '#1f2937' }
      },
      wallpaper: {
        type: { 
          type: String, 
          enum: ['none', 'color', 'gradient', 'pattern', 'image'], 
          default: 'none' 
        },
        value: { type: String, default: '#ffffff' },
        opacity: { type: Number, default: 1, min: 0.1, max: 1 },
        customImage: { type: String, default: null }
      },
      spacing: { 
        type: String, 
        enum: ['compact', 'normal', 'spacious'], 
        default: 'normal' 
      },
      animations: { type: Boolean, default: true },
      showAvatars: { type: Boolean, default: true },
      groupSimilarMessages: { type: Boolean, default: true }
    },
    privacy: {
      lastSeen: { 
        type: String, 
        enum: ['everyone', 'contacts', 'nobody'], 
        default: 'everyone' 
      },
      profilePhoto: { 
        type: String, 
        enum: ['everyone', 'contacts', 'nobody'], 
        default: 'everyone' 
      },
      about: { 
        type: String, 
        enum: ['everyone', 'contacts', 'nobody'], 
        default: 'everyone' 
      }
    },
    accessibility: {
      highContrast: { type: Boolean, default: false },
      reduceMotion: { type: Boolean, default: false },
      largerText: { type: Boolean, default: false },
      screenReaderSupport: { type: Boolean, default: false },
      keyboardNavigation: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Add to favorites
userSchema.methods.addToFavorites = function(userId) {
  if (!this.contacts.favorites.some(fav => fav.user.toString() === userId.toString())) {
    this.contacts.favorites.push({ user: userId });
  }
  return this.save();
};

// Remove from favorites
userSchema.methods.removeFromFavorites = function(userId) {
  this.contacts.favorites = this.contacts.favorites.filter(
    fav => fav.user.toString() !== userId.toString()
  );
  return this.save();
};

// Block user
userSchema.methods.blockUser = function(userId, reason = '') {
  if (!this.contacts.blocked.some(blocked => blocked.user.toString() === userId.toString())) {
    this.contacts.blocked.push({ user: userId, reason });
    // Remove from favorites if exists
    this.contacts.favorites = this.contacts.favorites.filter(
      fav => fav.user.toString() !== userId.toString()
    );
  }
  return this.save();
};

// Unblock user
userSchema.methods.unblockUser = function(userId) {
  this.contacts.blocked = this.contacts.blocked.filter(
    blocked => blocked.user.toString() !== userId.toString()
  );
  return this.save();
};

// Add badge
userSchema.methods.addBadge = function(badgeData) {
  const existingBadge = this.badges.find(badge => 
    badge.type === badgeData.type && badge.name === badgeData.name
  );
  
  if (!existingBadge) {
    this.badges.push(badgeData);
  }
  return this.save();
};

// Remove badge
userSchema.methods.removeBadge = function(badgeId) {
  this.badges = this.badges.filter(badge => badge._id.toString() !== badgeId.toString());
  return this.save();
};

// Check if user is blocked by another user
userSchema.methods.isBlockedBy = async function(userId) {
  const user = await mongoose.model('User').findById(userId);
  return user && user.contacts.blocked.some(blocked => blocked.user.toString() === this._id.toString());
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
