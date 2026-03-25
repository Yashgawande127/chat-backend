const SavedMessage = require('../models/SavedMessage');
const Message = require('../models/Message');

// @desc    Save a message as bookmark
// @route   POST /api/saved-messages
// @access  Private
const saveMessage = async (req, res) => {
  try {
    const { messageId, messageType, tags, note } = req.body;

    if (!messageId || !messageType) {
      return res.status(400).json({ error: 'Message ID and type are required' });
    }


    // Verify message exists (direct messages only)
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    // Verify user is sender or receiver
    if (!message.sender.equals(req.user._id) && !message.receiver.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create saved message
    const savedMessageData = {
      user: req.user._id,
      messageId,
      messageType: 'direct',
      tags: tags || [],
      note,
      directMessage: messageId
    };

    const savedMessage = await SavedMessage.create(savedMessageData);

    await savedMessage.populate([
      { path: 'directMessage', populate: { path: 'sender receiver', select: 'username profilePicture' } },

    ]);

    res.status(201).json({
      success: true,
      data: savedMessage
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Message already saved' });
    }
    console.error('Save message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get saved messages
// @route   GET /api/saved-messages
// @access  Private
const getSavedMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, messageType, tags, search } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { user: userId };
    
    if (messageType && messageType === 'direct') {
      query.messageType = messageType;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Text search in note
    if (search) {
      query.$or = [
        { note: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const savedMessages = await SavedMessage.find(query)
      .populate([
        { path: 'directMessage', populate: { path: 'sender receiver', select: 'username profilePicture' } }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SavedMessage.countDocuments(query);

    res.json({
      success: true,
      data: {
        savedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get saved messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Remove saved message
// @route   DELETE /api/saved-messages/:id
// @access  Private
const removeSavedMessage = async (req, res) => {
  try {
    const savedMessage = await SavedMessage.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!savedMessage) {
      return res.status(404).json({ error: 'Saved message not found' });
    }

    await savedMessage.deleteOne();

    res.json({
      success: true,
      message: 'Saved message removed'
    });
  } catch (error) {
    console.error('Remove saved message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update saved message
// @route   PUT /api/saved-messages/:id
// @access  Private
const updateSavedMessage = async (req, res) => {
  try {
    const { tags, note } = req.body;

    const savedMessage = await SavedMessage.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!savedMessage) {
      return res.status(404).json({ error: 'Saved message not found' });
    }

    if (tags !== undefined) {
      savedMessage.tags = tags;
    }
    if (note !== undefined) {
      savedMessage.note = note;
    }

    await savedMessage.save();
    await savedMessage.populate([
      { path: 'directMessage', populate: { path: 'sender receiver', select: 'username profilePicture' } }
    ]);

    res.json({
      success: true,
      data: savedMessage
    });
  } catch (error) {
    console.error('Update saved message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get all tags used by user
// @route   GET /api/saved-messages/tags
// @access  Private
const getTags = async (req, res) => {
  try {
    const tags = await SavedMessage.distinct('tags', { user: req.user._id });
    
    res.json({
      success: true,
      data: tags.filter(tag => tag) // Remove empty tags
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  saveMessage,
  getSavedMessages,
  removeSavedMessage,
  updateSavedMessage,
  getTags
};
