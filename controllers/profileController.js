const User = require('../models/User');
const Message = require('../models/Message');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Helper function to calculate user stats
const calculateUserStats = async (userId) => {
  try {
    // Count messages sent by user (direct messages only)
    const [directMessages, friendsCount, achievementsCount] = await Promise.all([
      Message.countDocuments({ sender: userId }),
      User.findById(userId).then(user => 
        user?.contacts?.friends?.filter(friend => friend.status === 'accepted')?.length || 0
      ),
      User.findById(userId).then(user => user?.badges?.length || 0)
    ]);

    const totalMessages = directMessages;

    return {
      messages: totalMessages,
      friends: friendsCount,
      achievements: achievementsCount
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      messages: 0,
      friends: 0,
      achievements: 0
    };
  }
};

// @desc    Get user profile
// @route   GET /api/profile/:id
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user._id;
    const user = await User.findById(userId)
      .select('-password')
      .populate('contacts.favorites.user', 'username avatar status')
      .populate('contacts.blocked.user', 'username avatar');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings if viewing another user's profile
    if (userId.toString() !== req.user._id.toString()) {
      const profileVisibility = user.settings?.account?.profileVisibility || 'public';
      
      if (profileVisibility === 'private') {
        return res.status(403).json({ error: 'Profile is private' });
      }
      
      if (profileVisibility === 'friends') {
        const isFavorite = user.contacts.favorites.some(
          fav => fav.user._id.toString() === req.user._id.toString()
        );
        if (!isFavorite) {
          return res.status(403).json({ error: 'Profile is only visible to friends' });
        }
      }

      // Check if current user is blocked
      const isBlocked = user.contacts.blocked.some(
        blocked => blocked.user._id.toString() === req.user._id.toString()
      );
      if (isBlocked) {
        return res.status(403).json({ error: 'You are blocked by this user' });
      }
    }

    // Calculate real-time stats
    const stats = await calculateUserStats(userId);
    
    // Add stats to user object
    const userWithStats = user.toObject();
    userWithStats.stats = stats;

    res.json({ profile: userWithStats });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
};

// @desc    Update user profile
// @route   PATCH /api/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { bio, interests, profileTheme } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update bio if provided
    if (bio !== undefined) {
      if (bio.length > 500) {
        return res.status(400).json({ error: 'Bio cannot exceed 500 characters' });
      }
      user.bio = bio;
    }

    // Update interests if provided
    if (interests !== undefined) {
      if (!Array.isArray(interests)) {
        return res.status(400).json({ error: 'Interests must be an array' });
      }
      if (interests.length > 10) {
        return res.status(400).json({ error: 'Cannot have more than 10 interests' });
      }
      user.interests = interests;
    }

    // Update profile theme if provided
    if (profileTheme !== undefined) {
      user.profileTheme = { ...user.profileTheme, ...profileTheme };
    }

    await user.save();

    // Calculate updated stats
    const stats = await calculateUserStats(req.user._id);
    
    // Add stats to user object
    const userWithStats = user.toObject();
    userWithStats.stats = stats;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: userWithStats
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
};

// @desc    Add user to favorites
// @route   POST /api/profile/favorites/:id
// @access  Private
const addToFavorites = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot add yourself to favorites' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(req.user._id);
    await user.addToFavorites(targetUserId);

    res.json({
      success: true,
      message: 'User added to favorites successfully'
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ error: 'Server error adding to favorites' });
  }
};

// @desc    Remove user from favorites
// @route   DELETE /api/profile/favorites/:id
// @access  Private
const removeFromFavorites = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(req.user._id);
    
    await user.removeFromFavorites(targetUserId);

    res.json({
      success: true,
      message: 'User removed from favorites successfully'
    });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ error: 'Server error removing from favorites' });
  }
};

// @desc    Block user
// @route   POST /api/profile/block/:id
// @access  Private
const blockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { reason } = req.body;
    
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findById(req.user._id);
    await user.blockUser(targetUserId, reason);

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Server error blocking user' });
  }
};

// @desc    Unblock user
// @route   DELETE /api/profile/block/:id
// @access  Private
const unblockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(req.user._id);
    
    await user.unblockUser(targetUserId);

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Server error unblocking user' });
  }
};

// @desc    Get user badges
// @route   GET /api/profile/badges
// @access  Private
const getUserBadges = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('badges');
    
    res.json({
      badges: user.badges.sort((a, b) => b.earnedAt - a.earnedAt)
    });
  } catch (error) {
    console.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Server error fetching badges' });
  }
};

// @desc    Award badge to user (Admin only)
// @route   POST /api/profile/badges/:userId
// @access  Private (Admin)
const awardBadge = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, name, description, icon, color } = req.body;

    // TODO: Add admin check middleware
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const badgeData = {
      type,
      name,
      description,
      icon,
      color: color || '#10b981'
    };

    await user.addBadge(badgeData);

    // Emit stats update for user
    if (req.app.locals.io && req.app.locals.io.emitStatsUpdate) {
      req.app.locals.io.emitStatsUpdate(userId);
    }

    res.json({
      success: true,
      message: 'Badge awarded successfully',
      badge: badgeData
    });
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ error: 'Server error awarding badge' });
  }
};

// @desc    Get favorites list
// @route   GET /api/profile/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts.favorites.user', 'username avatar status lastSeen bio')
      .select('contacts.favorites');

    res.json({
      favorites: user.contacts.favorites.sort((a, b) => b.addedAt - a.addedAt)
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Server error fetching favorites' });
  }
};

// @desc    Get blocked users list
// @route   GET /api/profile/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts.blocked.user', 'username avatar')
      .select('contacts.blocked');

    res.json({
      blocked: user.contacts.blocked.sort((a, b) => b.blockedAt - a.blockedAt)
    });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Server error fetching blocked users' });
  }
};

// @desc    Upload profile background image
// @route   POST /api/profile/background
// @access  Private
const uploadProfileBackground = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    const imagePath = `/uploads/backgrounds/${req.file.filename}`;
    
    user.profileTheme.backgroundImage = imagePath;
    user.profileTheme.backgroundType = 'image';
    await user.save();

    res.json({
      success: true,
      message: 'Background image uploaded successfully',
      backgroundImage: imagePath
    });
  } catch (error) {
    console.error('Error uploading background:', error);
    res.status(500).json({ error: 'Server error uploading background' });
  }
};

// @desc    Upload avatar
// @route   POST /api/profile/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = await User.findById(req.user._id);
    
    // Delete old avatar file if it exists
    if (user.avatar && user.avatar.startsWith('/uploads/avatars/')) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      try {
        await fs.unlink(oldAvatarPath);
      } catch (error) {
        console.log('Could not delete old avatar file:', error.message);
      }
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarPath;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarPath,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests,
        profileTheme: user.profileTheme
      }
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Server error uploading avatar' });
  }
};

// @desc    Delete avatar
// @route   DELETE /api/profile/avatar
// @access  Private
const deleteAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.avatar) {
      return res.status(400).json({ error: 'No avatar to delete' });
    }

    // Delete avatar file if it exists and is not a default avatar
    if (user.avatar.startsWith('/uploads/avatars/')) {
      const avatarPath = path.join(__dirname, '..', user.avatar);
      try {
        await fs.unlink(avatarPath);
      } catch (error) {
        console.log('Could not delete avatar file:', error.message);
      }
    }

    // Remove avatar from user
    user.avatar = null;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar deleted successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        interests: user.interests,
        profileTheme: user.profileTheme
      }
    });
  } catch (error) {
    console.error('Error deleting avatar:', error);
    res.status(500).json({ error: 'Server error deleting avatar' });
  }
};

// @desc    Get user stats for real-time updates
// @route   GET /api/profile/stats/:id?
// @access  Private
const getUserStats = async (req, res) => {
  try {
    const userId = req.params.id || req.user._id;
    const stats = await calculateUserStats(userId);
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Server error fetching stats' });
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  addToFavorites,
  removeFromFavorites,
  blockUser,
  unblockUser,
  getUserBadges,
  awardBadge,
  getFavorites,
  getBlockedUsers,
  uploadProfileBackground,
  uploadAvatar,
  deleteAvatar,
  getUserStats,
  calculateUserStats
};
