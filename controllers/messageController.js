const Message = require('../models/Message');
const User = require('../models/User');
const mediaProcessor = require('../utils/mediaProcessor');
const { sendNotificationWithPreferences } = require('../utils/notificationHelper');
const { getFileCategory } = require('../config/multer');
const path = require('path');
const fs = require('fs');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    console.log('=== SEND MESSAGE ENDPOINT HIT ===');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    
    const { receiverId, content, messageType = 'text' } = req.body;

    console.log('Parsed values - receiverId:', receiverId, 'content:', content, 'messageType:', messageType);

    if (!receiverId) {
      console.log('Error: receiverId is missing');
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    // For text messages, content is required
    if (messageType === 'text' && !content) {
      console.log('Error: content is missing for text message');
      return res.status(400).json({ error: 'Message content is required' });
    }

    console.log('Looking up receiver with ID:', receiverId);
    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Create message object
    const messageData = {
      sender: req.user._id,
      receiver: receiverId,
      messageType
    };

    // Handle file uploads
    if (req.file) {
      const file = req.file;
      const fileCategory = getFileCategory(file.mimetype);
      
      messageData.messageType = fileCategory === 'document' ? 'file' : fileCategory;
      messageData.fileName = file.originalname;
      messageData.fileSize = file.size;
      messageData.mimeType = file.mimetype;
      messageData.fileUrl = `/uploads/messages/${file.filename}`;

      // Process media files
      try {
        if (fileCategory === 'image') {
          const processed = await mediaProcessor.processImage(file.path, {
            createThumbnail: true
          });
          messageData.thumbnailUrl = processed.thumbnailUrl;
          messageData.dimensions = processed.dimensions;
          
          // Use processed image if available
          if (processed.processedPath !== file.path) {
            messageData.fileUrl = processed.url;
          }
        } else if (fileCategory === 'video') {
          const processed = await mediaProcessor.processVideo(file.path);
          messageData.thumbnailUrl = processed.thumbnailUrl;
          messageData.duration = processed.duration;
          messageData.dimensions = processed.dimensions;
        } else if (fileCategory === 'audio') {
          const processed = await mediaProcessor.processAudio(file.path);
          messageData.duration = processed.duration;
        }
      } catch (error) {
        console.error('Error processing media file:', error);
        // Continue with unprocessed file
      }

      // Set content as filename if not provided
      if (!content) {
        messageData.content = file.originalname;
      } else {
        messageData.content = content;
      }
    } else {
      messageData.content = content;
    }

    // Create message
    const message = new Message(messageData);
    await message.save();

    // Populate sender and receiver info
    await message.populate('sender', 'username avatar');
    await message.populate('receiver', 'username avatar');

    // Emit real-time message events
    if (req.app.locals.io) {
      // Emit to receiver for new message
      req.app.locals.io.to(`user_${receiverId}`).emit('new_message', message);
      
      // Emit to sender for message sent confirmation
      req.app.locals.io.to(`user_${req.user._id}`).emit('message_sent', {
        success: true,
        message: message
      });

      // Send real-time notification to receiver
      try {
        await sendNotificationWithPreferences(
          req.app.locals.io,
          receiverId,
          {
            recipient: receiverId,
            sender: req.user._id,
            type: 'message',
            title: `New message from ${req.user.username}`,
            content: messageType === 'text' ? content : `Sent a ${messageType}`,
            messageId: message._id
          }
        );
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Don't fail the message sending if notification fails
      }
    }

    // Emit stats update for sender
    if (req.app.locals.io && req.app.locals.io.emitStatsUpdate) {
      req.app.locals.io.emitStatsUpdate(req.user._id);
    }

    // Check and send auto-response
    const { checkAndSendAutoResponse } = require('./autoResponseController');
    checkAndSendAutoResponse(req.user._id, receiverId, content || messageData.content);

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: errors.join(', ') });
    }
    res.status(500).json({ error: 'Server error sending message' });
  }
};

// @desc    Get messages between two users
// @route   GET /api/messages/conversation/:userId
// @access  Private
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 50, 
      search, 
      messageType, 
      dateFrom, 
      dateTo 
    } = req.query;

    // Check if the other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build query
    const query = {
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    };

    // Add search filter
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { content: { $regex: search, $options: 'i' } },
          { fileName: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Add message type filter
    if (messageType && messageType !== 'all') {
      query.messageType = messageType;
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    const messages = await Message.find(query)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments(query);

    res.json({
      messages: messages.reverse(),
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching messages' });
  }
};

// @desc    Mark messages as read
// @route   PATCH /api/messages/read/:senderId
// @access  Private
const markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;

    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: req.user._id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error marking messages as read' });
  }
};

// @desc    Edit a message
// @route   PATCH /api/messages/:messageId
// @access  Private
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    // Check if message is not too old (e.g., 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      return res.status(400).json({ error: 'Cannot edit messages older than 15 minutes' });
    }

    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    await message.populate('sender', 'username avatar');
    await message.populate('receiver', 'username avatar');

    res.json({
      message: 'Message updated successfully',
      data: message
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error editing message' });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting message' });
  }
};

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching unread count' });
  }
};

// @desc    Delete entire conversation
// @route   DELETE /api/messages/conversation/:userId
// @access  Private
const deleteConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Delete all messages between the two users
    await Message.deleteMany({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    });

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error deleting conversation' });
  }
};



// @desc    Search messages across all conversations
// @route   GET /api/messages/search
// @access  Private
const searchMessages = async (req, res) => {
  try {
    const { 
      q, 
      page = 1, 
      limit = 20, 
      messageType, 
      userId, 
      dateFrom, 
      dateTo 
    } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Build base query - user must be sender or receiver
    const baseQuery = {
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    };

    // Build search conditions
    const searchConditions = [];

    // Text search in content and filename
    searchConditions.push({
      $or: [
        { content: { $regex: q, $options: 'i' } },
        { fileName: { $regex: q, $options: 'i' } }
      ]
    });

    // Add message type filter
    if (messageType && messageType !== 'all') {
      searchConditions.push({ messageType });
    }

    // Add specific user filter
    if (userId) {
      searchConditions.push({
        $or: [
          { sender: userId },
          { receiver: userId }
        ]
      });
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.$lte = new Date(dateTo);
      searchConditions.push({ createdAt: dateFilter });
    }

    // Combine all conditions
    const query = {
      $and: [baseQuery, ...searchConditions]
    };

    const messages = await Message.find(query)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// @desc    Get conversations with filters
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const { search, dateFrom, dateTo } = req.query;
    const userId = req.user._id;

    // Get all conversations (unique users)
    const conversationPipeline = [
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ]
        }
      }
    ];

    // Add date filter if provided
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) dateFilter.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.$lte = new Date(dateTo);
      conversationPipeline[0].$match.createdAt = dateFilter;
    }

    conversationPipeline.push(
      {
        $addFields: {
          otherUser: {
            $cond: {
              if: { $eq: ['$sender', userId] },
              then: '$receiver',
              else: '$sender'
            }
          }
        }
      },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ['$receiver', userId] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    );

    let conversations = await Message.aggregate(conversationPipeline);

    // Apply search filter on user info
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      conversations = conversations.filter(conv => 
        searchRegex.test(conv.userInfo.username) ||
        searchRegex.test(conv.lastMessage.content || '')
      );
    }

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Add reaction to a message
// @route   POST /api/messages/:messageId/reaction
// @access  Private
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || !['👍', '❤️', '😂', '😮', '😢', '😡'].includes(emoji)) {
      return res.status(400).json({ error: 'Valid emoji is required' });
    }

    const MessageModel = Message;
    const message = await MessageModel.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      reaction => reaction.user.toString() === req.user._id.toString() && reaction.emoji === emoji
    );

    if (existingReaction) {
      // Remove the reaction if it already exists
      message.reactions = message.reactions.filter(
        reaction => !(reaction.user.toString() === req.user._id.toString() && reaction.emoji === emoji)
      );
    } else {
      // Remove any other reactions from this user and add the new one
      message.reactions = message.reactions.filter(
        reaction => reaction.user.toString() !== req.user._id.toString()
      );
      message.reactions.push({
        user: req.user._id,
        emoji: emoji
      });
    }

    await message.save();
    await message.populate('reactions.user', 'username avatar');

    // Send notification for new reaction (not for removing reaction)
    if (!existingReaction && req.app.locals.io) {
      try {
        // Get the message owner to send notification
        const recipientId = message.sender.toString() === req.user._id.toString() 
          ? message.receiver 
          : message.sender;
        const notificationTitle = `${req.user.username} reacted to your message`;
        const notificationContent = `Reacted with ${emoji}`;

        // Only send notification if the reaction is not from the message sender
        if (recipientId.toString() !== req.user._id.toString()) {
          await sendNotificationWithPreferences(
            req.app.locals.io,
            recipientId,
            {
              recipient: recipientId,
              sender: req.user._id,
              type: 'reaction',
              title: notificationTitle,
              content: notificationContent,
              messageId: message._id,
              emoji: emoji
            }
          );
        }
      } catch (notificationError) {
        console.error('Error sending reaction notification:', notificationError);
        // Don't fail the reaction if notification fails
      }
    }

    res.json({
      success: true,
      data: message.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Forward a message
// @route   POST /api/messages/:messageId/forward
// @access  Private
const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { receiverIds } = req.body;

    if (!receiverIds || receiverIds.length === 0) {
      return res.status(400).json({ error: 'At least one receiver is required' });
    }

    const MessageModel = Message;
    const originalMessage = await MessageModel.findById(messageId)
      .populate('sender', 'username avatar');

    if (!originalMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const forwardedMessages = [];

    // Forward to individual users
    if (receiverIds && receiverIds.length > 0) {
      for (const receiverId of receiverIds) {
        const receiver = await User.findById(receiverId);
        if (!receiver) continue;

        const forwardedMessage = new Message({
          sender: req.user._id,
          receiver: receiverId,
          content: originalMessage.content,
          messageType: originalMessage.messageType,
          fileUrl: originalMessage.fileUrl,
          fileName: originalMessage.fileName,
          fileSize: originalMessage.fileSize,
          mimeType: originalMessage.mimeType,
          thumbnailUrl: originalMessage.thumbnailUrl,
          duration: originalMessage.duration,
          dimensions: originalMessage.dimensions,
          forwardedFrom: {
            originalMessage: originalMessage._id,
            originalSender: originalMessage.sender._id
          }
        });

        await forwardedMessage.save();
        await forwardedMessage.populate('sender', 'username avatar');
        await forwardedMessage.populate('forwardedFrom.originalSender', 'username avatar');
        forwardedMessages.push(forwardedMessage);
      }
    }



    res.json({
      success: true,
      message: 'Message forwarded successfully',
      data: forwardedMessages
    });
  } catch (error) {
    console.error('Forward message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Pin/Unpin a message
// @route   PATCH /api/messages/:messageId/pin
// @access  Private
const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const MessageModel = Message;
    const message = await MessageModel.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // For personal messages, check if user is sender or receiver
    if (message.sender.toString() !== req.user._id.toString() && 
        message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    message.isPinned = !message.isPinned;
    message.pinnedAt = message.isPinned ? new Date() : null;
    message.pinnedBy = message.isPinned ? req.user._id : null;

    await message.save();
    await message.populate('pinnedBy', 'username avatar');

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Toggle pin message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get pinned messages
// @route   GET /api/messages/pinned
// @access  Private
const getPinnedMessages = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let query = { 
      isPinned: true,
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    };
    let MessageModel = Message;

    const pinnedMessages = await MessageModel.find(query)
      .populate('sender', 'username avatar')
      .populate('pinnedBy', 'username avatar')
      .populate('replyTo')
      .populate('forwardedFrom.originalSender', 'username avatar')
      .sort({ pinnedAt: -1 });

    res.json({
      success: true,
      data: pinnedMessages
    });
  } catch (error) {
    console.error('Get pinned messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Reply to a message
// @route   POST /api/messages/reply
// @access  Private
const replyToMessage = async (req, res) => {
  try {
    const { replyToId, content, receiverId, messageType = 'text' } = req.body;

    if (!replyToId) {
      return res.status(400).json({ error: 'Reply to message ID is required' });
    }

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (!content && messageType === 'text') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // User message reply
    const originalMessage = await Message.findById(replyToId);
    if (!originalMessage) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    // Check if user has access to the original message
    if (originalMessage.sender.toString() !== req.user._id.toString() && 
        originalMessage.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

      const messageData = {
        sender: req.user._id,
        receiver: receiverId,
        content,
        messageType,
        replyTo: replyToId
      };

      // Handle file uploads
      if (req.file) {
        const file = req.file;
        const fileCategory = getFileCategory(file.mimetype);
        
        messageData.messageType = fileCategory === 'document' ? 'file' : fileCategory;
        messageData.fileName = file.originalname;
        messageData.fileSize = file.size;
        messageData.mimeType = file.mimetype;
        messageData.fileUrl = `/uploads/messages/${file.filename}`;

        // Process media files
        if (fileCategory === 'image' || fileCategory === 'video') {
          try {
            const processedMedia = await mediaProcessor.processMedia(file.path, file.mimetype);
            if (processedMedia.thumbnail) {
              messageData.thumbnailUrl = processedMedia.thumbnail;
            }
            if (processedMedia.dimensions) {
              messageData.dimensions = processedMedia.dimensions;
            }
            if (processedMedia.duration) {
              messageData.duration = processedMedia.duration;
            }
          } catch (error) {
            console.error('Media processing error:', error);
          }
        }
      }

    const replyMessage = new Message(messageData);
    await replyMessage.save();

    await replyMessage.populate('sender', 'username avatar');
    await replyMessage.populate('replyTo');

    res.status(201).json({
      success: true,
      data: replyMessage
    });
  } catch (error) {
    console.error('Reply to message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  sendMessage,
  getConversation,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  deleteConversation,
  getUnreadCount,
  searchMessages,
  getConversations,
  addReaction,
  forwardMessage,
  togglePinMessage,
  getPinnedMessages,
  replyToMessage
};
