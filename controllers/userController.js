const User = require('../models/User');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const Notification = require('../models/Notification');

// @desc    Get all users (for search/contact list)
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query; // Increased default limit for better real-time experience
    const query = { _id: { $ne: req.user._id } }; // Exclude current user

    if (search) {
      // Enhanced search with better regex for real-time search
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { username: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }
      ];
    }

    const users = await User.find(query)
      .select('username email avatar status lastSeen bio')
      .sort({ 
        status: -1, // Online users first
        username: 1, // Then alphabetically
        lastSeen: -1 // Then by last activity
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean() for better performance

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error fetching users' });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email avatar status lastSeen createdAt bio interests verification badges profileTheme')
      .populate('contacts.favorites.user', 'username avatar status')
      .populate('contacts.blocked.user', 'username avatar');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if current user is blocked
    const isBlocked = user.contacts.blocked.some(
      blocked => blocked.user._id.toString() === req.user._id.toString()
    );
    
    if (isBlocked) {
      return res.status(403).json({ error: 'You are blocked by this user' });
    }

    // Check privacy settings
    const profileVisibility = user.settings?.account?.profileVisibility || 'public';
    
    if (profileVisibility === 'private' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Profile is private' });
    }
    
    if (profileVisibility === 'friends' && user._id.toString() !== req.user._id.toString()) {
      const isFavorite = user.contacts.favorites.some(
        fav => fav.user._id.toString() === req.user._id.toString()
      );
      if (!isFavorite) {
        return res.status(403).json({ error: 'Profile is only visible to favorites' });
      }
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching user' });
  }
};

// @desc    Get conversation history with another user
// @route   GET /api/users/:id/messages
// @access  Private
const getConversationMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const otherUserId = req.params.id;

    // Check if the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read
    await Message.updateMany(
      {
        sender: otherUserId,
        receiver: req.user._id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    const total = await Message.countDocuments({
      $or: [
        { sender: req.user._id, receiver: otherUserId },
        { sender: otherUserId, receiver: req.user._id }
      ]
    });

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching messages' });
  }
};

// @desc    Get recent conversations
// @route   GET /api/users/conversations/recent
// @access  Private
const getRecentConversations = async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', req.user._id] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            avatar: '$user.avatar',
            status: '$user.status',
            lastSeen: '$user.lastSeen'
          },
          lastMessage: '$lastMessage',
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching conversations' });
  }
};

// @desc    Update user status
// @route   PATCH /api/users/status
// @access  Private
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    req.user.status = status;
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      message: 'Status updated successfully',
      status: req.user.status
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating status' });
  }
};

// @desc    Get user settings
// @route   GET /api/users/settings
// @access  Private
const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings');
    
    const defaultSettings = {
      theme: 'light',
      notifications: {
        email: true,
        push: true,
        desktop: true,
        sound: true,
        newMessages: true,
        roomInvites: true,
        mentions: true,
        reactions: true,
      },
      account: {
        language: 'en',
        timezone: 'America/New_York',
        autoSave: true,
        readReceipts: true,
        onlineStatus: true,
        profileVisibility: 'public',
      },
      chat: {
        fontSize: 'medium',
        enterToSend: true,
        showTypingIndicator: true,
        groupMessagesByDate: true,
        messagePreview: true,
        autoDownload: 'wifi',
      },
      customTheme: {
        name: 'default',
        primary: '#3b82f6',
        secondary: '#1e40af',
        accent: '#06b6d4',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1f2937',
        textSecondary: '#6b7280',
        isCustom: false
      },
      chatCustomization: {
        bubbleStyle: 'rounded',
        bubbleColors: {
          sent: '#3b82f6',
          received: '#e5e7eb',
          sentText: '#ffffff',
          receivedText: '#1f2937'
        },
        wallpaper: {
          type: 'none',
          value: '#ffffff',
          opacity: 1,
          customImage: null
        },
        spacing: 'normal',
        animations: true,
        showAvatars: true,
        groupSimilarMessages: true
      },
      privacy: {
        lastSeen: 'everyone',
        profilePhoto: 'everyone',
        about: 'everyone',
      },
      accessibility: {
        highContrast: false,
        reduceMotion: false,
        largerText: false,
        screenReaderSupport: false,
        keyboardNavigation: true,
      },
    };

    const settings = user.settings ? { ...defaultSettings, ...user.settings } : defaultSettings;

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Server error fetching settings' });
  }
};

// @desc    Update user settings
// @route   PATCH /api/users/settings
// @access  Private
const updateUserSettings = async (req, res) => {
  try {
    const { category, settings } = req.body;

    if (!category || !settings) {
      return res.status(400).json({ error: 'Category and settings are required' });
    }

    const validCategories = ['theme', 'notifications', 'account', 'chat', 'customTheme', 'chatCustomization', 'privacy', 'accessibility'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid settings category' });
    }

    const user = await User.findById(req.user._id);
    
    if (!user.settings) {
      user.settings = {};
    }

    if (category === 'theme') {
      user.settings.theme = settings.theme;
    } else {
      user.settings[category] = { ...user.settings[category], ...settings };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: user.settings
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Server error updating settings' });
  }
};

// @desc    Reset user settings to default
// @route   POST /api/users/settings/reset
// @access  Private
const resetUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.settings = undefined; // Remove settings to use defaults
    await user.save();

    res.json({
      success: true,
      message: 'Settings reset to default successfully'
    });
  } catch (error) {
    console.error('Error resetting user settings:', error);
    res.status(500).json({ error: 'Server error resetting settings' });
  }
};

// @desc    Send friend request
// @route   POST /api/users/:id/friend-request
// @access  Private
const sendFriendRequest = async (req, res) => {
  console.log('=== SEND FRIEND REQUEST ENDPOINT HIT ===');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Headers:', req.headers);
  console.log('User from token:', req.user);
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  
  try {
    const { id: receiverId } = req.params;
    const { message = '' } = req.body;
    const senderId = req.user._id;

    console.log('Send friend request - senderId:', senderId, 'receiverId:', receiverId, 'message:', message);

    // Check if user is trying to send request to themselves
    if (senderId.toString() === receiverId) {
      console.log('Error: User trying to send request to themselves');
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      console.log('Error: Receiver not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Receiver found:', receiver.username);

    // Check if they are already friends
    const sender = await User.findById(senderId);
    console.log('Sender found:', sender.username);
    const existingFriend = sender.contacts.friends.find(
      friend => friend.user.toString() === receiverId && friend.status === 'accepted'
    );
    if (existingFriend) {
      console.log('Error: Already friends');
      return res.status(400).json({ error: 'You are already friends with this user' });
    }

    console.log('Not already friends, checking for existing requests');

    // Check if current user already sent a request to the receiver
    const existingSentRequest = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId
    });

    console.log('Existing sent request:', existingSentRequest);

    if (existingSentRequest && existingSentRequest.status === 'pending') {
      console.log('Found pending sent request, returning error');
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Check if receiver already sent a request to current user (mutual request scenario)
    const existingReceivedRequest = await FriendRequest.findOne({
      sender: receiverId,
      receiver: senderId,
      status: 'pending'
    });

    console.log('Existing received request:', existingReceivedRequest);

    if (existingReceivedRequest) {
      console.log('Found mutual request scenario, auto-accepting...');
      // Automatically accept the existing request (mutual friend request)
      existingReceivedRequest.status = 'accepted';
      existingReceivedRequest.respondedAt = new Date();
      await existingReceivedRequest.save();

      // Add each other as friends
      sender.contacts.friends.push({
        user: receiverId,
        status: 'accepted',
        acceptedAt: new Date()
      });

      receiver.contacts.friends.push({
        user: senderId,
        status: 'accepted',
        acceptedAt: new Date()
      });

      await sender.save();
      await receiver.save();

      // Create notifications for both users
      await Notification.create({
        recipient: receiverId,
        sender: senderId,
        type: 'friend_request',
        title: 'Friend Request Accepted',
        content: `${sender.username} accepted your friend request`,
        data: {
          userId: senderId,
          username: sender.username,
          avatar: sender.avatar
        }
      });

      await Notification.create({
        recipient: senderId,
        sender: receiverId,
        type: 'friend_request',
        title: 'Friend Request Accepted',
        content: `${receiver.username} accepted your friend request`,
        data: {
          userId: receiverId,
          username: receiver.username,
          avatar: receiver.avatar
        }
      });

      return res.json({ message: 'Friend request automatically accepted - you are now friends!' });
    }

    if (existingSentRequest && existingSentRequest.status === 'rejected') {
      console.log('Updating existing rejected request to pending...');
      // Update existing rejected request
      existingSentRequest.message = message;
      existingSentRequest.status = 'pending';
      existingSentRequest.sentAt = new Date();
      existingSentRequest.respondedAt = undefined;
      await existingSentRequest.save();
      console.log('Updated rejected request to pending');
    } else if (!existingSentRequest) {
      console.log('No existing sent request, creating new friend request...');
      // Create new friend request (only if no existing request)
      await FriendRequest.create({
        sender: senderId,
        receiver: receiverId,
        message
      });
      console.log('Created new friend request');
    } else {
      console.log('Existing sent request found with status:', existingSentRequest?.status);
    }

    // Create notification for receiver
    await Notification.create({
      recipient: receiverId,
      sender: senderId,
      type: 'friend_request',
      title: 'New Friend Request',
      content: `${sender.username} sent you a friend request`,
      data: {
        senderId: senderId,
        senderUsername: sender.username,
        senderAvatar: sender.avatar,
        message: message
      }
    });

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Send friend request error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Server error sending friend request: ' + error.message });
  }
};

// @desc    Respond to friend request
// @route   PATCH /api/users/friend-request/:requestId
// @access  Private
const respondToFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user._id;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "accept" or "reject"' });
    }

    const friendRequest = await FriendRequest.findById(requestId)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Check if user is the receiver of the request
    if (friendRequest.receiver._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'You can only respond to requests sent to you' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'This friend request has already been responded to' });
    }

    // Update friend request status
    friendRequest.status = action === 'accept' ? 'accepted' : 'rejected';
    friendRequest.respondedAt = new Date();
    await friendRequest.save();

    if (action === 'accept') {
      // Add each other as friends
      const sender = await User.findById(friendRequest.sender._id);
      const receiver = await User.findById(friendRequest.receiver._id);

      // Add to sender's friends list
      sender.contacts.friends.push({
        user: receiver._id,
        status: 'accepted',
        acceptedAt: new Date()
      });

      // Add to receiver's friends list
      receiver.contacts.friends.push({
        user: sender._id,
        status: 'accepted',
        acceptedAt: new Date()
      });

      await sender.save();
      await receiver.save();

      // Emit stats updates for both users
      if (req.app.locals.io && req.app.locals.io.emitStatsUpdate) {
        req.app.locals.io.emitStatsUpdate(sender._id);
        req.app.locals.io.emitStatsUpdate(receiver._id);
      }

      // Create notification for sender
      await Notification.create({
        recipient: friendRequest.sender._id,
        sender: receiver._id,
        type: 'friend_request',
        title: 'Friend Request Accepted',
        content: `${receiver.username} accepted your friend request`,
        data: {
          userId: receiver._id,
          username: receiver.username,
          avatar: receiver.avatar
        }
      });
    }

    res.json({ 
      message: `Friend request ${action}ed successfully`,
      friendRequest 
    });
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ error: 'Server error responding to friend request' });
  }
};

// @desc    Get friend requests
// @route   GET /api/users/friend-requests
// @access  Private
const getFriendRequests = async (req, res) => {
  try {
    const { type = 'received' } = req.query; // 'sent' or 'received'
    const userId = req.user._id;

    const query = type === 'sent' 
      ? { sender: userId } 
      : { receiver: userId };

    const friendRequests = await FriendRequest.find({
      ...query,
      status: 'pending'
    })
    .populate('sender', 'username avatar status lastSeen')
    .populate('receiver', 'username avatar status lastSeen')
    .sort({ sentAt: -1 });

    // Filter out and cleanup requests where sender or receiver is null (deleted users)
    const validFriendRequests = [];
    const invalidRequestIds = [];

    for (const request of friendRequests) {
      if (request.sender && request.receiver && request.sender._id && request.receiver._id) {
        validFriendRequests.push(request);
      } else {
        invalidRequestIds.push(request._id);
      }
    }

    // Cleanup invalid requests in background
    if (invalidRequestIds.length > 0) {
      FriendRequest.deleteMany({ _id: { $in: invalidRequestIds } })
        .catch(err => console.error('Error cleaning up invalid friend requests:', err));
    }

    res.json({ friendRequests: validFriendRequests });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Server error fetching friend requests' });
  }
};

// @desc    Get user's friends
// @route   GET /api/users/friends
// @access  Private
const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .populate({
        path: 'contacts.friends.user',
        select: 'username avatar status lastSeen bio',
        match: { 'contacts.friends.status': 'accepted' }
      });

    const acceptedFriends = user.contacts.friends
      .filter(friend => friend.status === 'accepted' && friend.user && friend.user._id)
      .map(friend => ({
        _id: friend._id,
        user: friend.user,
        addedAt: friend.addedAt,
        acceptedAt: friend.acceptedAt
      }));

    res.json({ friends: acceptedFriends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Server error fetching friends' });
  }
};

// @desc    Remove friend
// @route   DELETE /api/users/friends/:friendId
// @access  Private
const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Remove from current user's friends list
    await User.findByIdAndUpdate(userId, {
      $pull: { 'contacts.friends': { user: friendId } }
    });

    // Remove from friend's friends list
    await User.findByIdAndUpdate(friendId, {
      $pull: { 'contacts.friends': { user: userId } }
    });

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Server error removing friend' });
  }
};

// @desc    Export user data
// @route   GET /api/users/export-data
// @access  Private
const exportUserData = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user data
    const user = await User.findById(userId)
      .select('-password')
      .populate('contacts.favorites.user', 'username email')
      .populate('contacts.blocked.user', 'username email');

    // Get user's messages
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate('sender', 'username email')
    .populate('receiver', 'username email')
    .sort({ createdAt: -1 })
    .limit(1000); // Limit to recent 1000 messages

    // Get friend requests
    const friendRequests = await FriendRequest.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ]
    })
    .populate('sender', 'username email')
    .populate('receiver', 'username email');

    // Get notifications
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(100); // Limit to recent 100 notifications

    // Prepare export data
    const exportData = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        interests: user.interests,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        verification: user.verification,
        badges: user.badges,
        settings: user.settings,
        contacts: user.contacts
      },
      messages: messages.map(msg => ({
        id: msg._id,
        content: msg.content,
        type: msg.type,
        sender: msg.sender ? {
          id: msg.sender._id,
          username: msg.sender.username,
          email: msg.sender.email
        } : null,
        receiver: msg.receiver ? {
          id: msg.receiver._id,
          username: msg.receiver.username,
          email: msg.receiver.email
        } : null,
        createdAt: msg.createdAt,
        readAt: msg.readAt,
        deliveredAt: msg.deliveredAt
      })),
      friendRequests: friendRequests.map(req => ({
        id: req._id,
        sender: req.sender ? {
          id: req.sender._id,
          username: req.sender.username,
          email: req.sender.email
        } : null,
        receiver: req.receiver ? {
          id: req.receiver._id,
          username: req.receiver.username,
          email: req.receiver.email
        } : null,
        status: req.status,
        createdAt: req.createdAt
      })),
      notifications: notifications.map(notif => ({
        id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        read: notif.read,
        createdAt: notif.createdAt
      })),
      exportInfo: {
        exportDate: new Date().toISOString(),
        dataVersion: '1.0',
        totalMessages: messages.length,
        totalFriendRequests: friendRequests.length,
        totalNotifications: notifications.length
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="chat-data-${user.username}-${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(exportData);
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({ error: 'Server error exporting user data' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getConversationMessages,
  getRecentConversations,
  updateUserStatus,
  getUserSettings,
  updateUserSettings,
  resetUserSettings,
  sendFriendRequest,
  respondToFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  exportUserData
};
