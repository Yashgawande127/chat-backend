const MessageArchive = require('../models/MessageArchive');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Create message archive
// @route   POST /api/archives
// @access  Private
const createArchive = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      archiveType, 
      otherUserId, 
 
      dateFrom, 
      dateTo, 
      tags 
    } = req.body;

    if (!title || !archiveType || !dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'Title, archive type, date from, and date to are required' 
      });
    }

    if (archiveType !== 'conversation') {
      return res.status(400).json({ error: 'Invalid archive type' });
    }

    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    if (fromDate >= toDate) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    let messages = [];
    let archiveData = {
      user: req.user._id,
      title,
      description,
      archiveType,
      dateFrom: fromDate,
      dateTo: toDate,
      tags: tags || []
    };

    if (archiveType === 'conversation') {
      if (!otherUserId) {
        return res.status(400).json({ error: 'Other user ID is required for conversation archive' });
      }

      // Verify other user exists
      const otherUser = await User.findById(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ error: 'Other user not found' });
      }

      archiveData.otherUser = otherUserId;

      // Get messages between users in date range
      messages = await Message.find({
        $or: [
          { sender: req.user._id, receiver: otherUserId },
          { sender: otherUserId, receiver: req.user._id }
        ],
        createdAt: { $gte: fromDate, $lte: toDate }
      })
      .populate('sender', 'username profilePicture')
      .sort({ createdAt: 1 });
    }

    // Convert messages to plain objects for storage
    archiveData.messages = messages.map(msg => ({
      originalId: msg._id,
      sender: msg.sender._id,
      content: msg.content,
      messageType: msg.messageType,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt
    }));

    archiveData.messageCount = messages.length;

    const archive = await MessageArchive.create(archiveData);

    await archive.populate([
      { path: 'otherUser', select: 'username profilePicture' }
    ]);

    res.status(201).json({
      success: true,
      data: archive
    });
  } catch (error) {
    console.error('Create archive error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get user's archives
// @route   GET /api/archives
// @access  Private
const getArchives = async (req, res) => {
  try {
    const { page = 1, limit = 20, archiveType, tags, search } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { user: userId };
    
    if (archiveType && archiveType === 'conversation') {
      query.archiveType = archiveType;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Text search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const archives = await MessageArchive.find(query)
      .populate('otherUser', 'username profilePicture')

      .select('-messages') // Don't include messages in list view
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MessageArchive.countDocuments(query);

    res.json({
      success: true,
      data: {
        archives,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get archives error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get single archive with messages
// @route   GET /api/archives/:id
// @access  Private
const getArchive = async (req, res) => {
  try {
    const archive = await MessageArchive.findOne({
      _id: req.params.id,
      user: req.user._id
    })
    .populate('otherUser', 'username profilePicture')
    .populate('messages.sender', 'username profilePicture');

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    res.json({
      success: true,
      data: archive
    });
  } catch (error) {
    console.error('Get archive error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Update archive
// @route   PUT /api/archives/:id
// @access  Private
const updateArchive = async (req, res) => {
  try {
    const { title, description, tags } = req.body;

    const archive = await MessageArchive.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    if (title !== undefined) archive.title = title;
    if (description !== undefined) archive.description = description;
    if (tags !== undefined) archive.tags = tags;

    await archive.save();
    await archive.populate([
      { path: 'otherUser', select: 'username profilePicture' }
    ]);

    res.json({
      success: true,
      data: archive
    });
  } catch (error) {
    console.error('Update archive error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Delete archive
// @route   DELETE /api/archives/:id
// @access  Private
const deleteArchive = async (req, res) => {
  try {
    const archive = await MessageArchive.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    await archive.deleteOne();

    res.json({
      success: true,
      message: 'Archive deleted'
    });
  } catch (error) {
    console.error('Delete archive error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Search within archive messages
// @route   GET /api/archives/:id/search
// @access  Private
const searchArchiveMessages = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const archive = await MessageArchive.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    // Search within archive messages
    const searchRegex = new RegExp(q, 'i');
    const matchingMessages = archive.messages.filter(msg => 
      searchRegex.test(msg.content || '') || 
      searchRegex.test(msg.fileName || '')
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedMessages = matchingMessages.slice(skip, skip + parseInt(limit));

    // Populate sender info
    const populatedMessages = await User.populate(paginatedMessages, {
      path: 'sender',
      select: 'username profilePicture'
    });

    res.json({
      success: true,
      data: {
        messages: populatedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: matchingMessages.length,
          pages: Math.ceil(matchingMessages.length / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Search archive messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createArchive,
  getArchives,
  getArchive,
  updateArchive,
  deleteArchive,
  searchArchiveMessages
};
