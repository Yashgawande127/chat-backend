const AutoResponse = require('../models/AutoResponse');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Create auto-response
// @route   POST /api/auto-responses
// @access  Private
const createAutoResponse = async (req, res) => {
  try {
    const {
      name,
      message,
      type = 'away',
      triggers = ['all_messages'],
      keywords = [],
      timeRules = {},
      excludeContacts = [],
      onlyForContacts = [],
      delay = 0
    } = req.body;

    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    if (delay < 0 || delay > 300) {
      return res.status(400).json({ error: 'Delay must be between 0 and 300 seconds' });
    }

    const autoResponse = new AutoResponse({
      user: req.user._id,
      name,
      message,
      type,
      triggers,
      keywords: keywords.map(k => k.toLowerCase()),
      timeRules,
      excludeContacts,
      onlyForContacts,
      delay
    });

    await autoResponse.save();

    await autoResponse.populate([
      { path: 'excludeContacts', select: 'username avatar' },
      { path: 'onlyForContacts', select: 'username avatar' }
    ]);

    res.status(201).json({
      message: 'Auto-response created successfully',
      autoResponse
    });
  } catch (error) {
    console.error('Error creating auto-response:', error);
    res.status(500).json({ error: 'Failed to create auto-response' });
  }
};

// @desc    Get user auto-responses
// @route   GET /api/auto-responses
// @access  Private
const getAutoResponses = async (req, res) => {
  try {
    const { isActive, type, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const autoResponses = await AutoResponse.find(query)
      .populate('excludeContacts', 'username avatar')
      .populate('onlyForContacts', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AutoResponse.countDocuments(query);

    res.json({
      autoResponses,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching auto-responses:', error);
    res.status(500).json({ error: 'Failed to fetch auto-responses' });
  }
};

// @desc    Update auto-response
// @route   PUT /api/auto-responses/:id
// @access  Private
const updateAutoResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const autoResponse = await AutoResponse.findOne({
      _id: id,
      user: req.user._id
    });

    if (!autoResponse) {
      return res.status(404).json({ error: 'Auto-response not found' });
    }

    // Validate delay if being updated
    if (updates.delay !== undefined && (updates.delay < 0 || updates.delay > 300)) {
      return res.status(400).json({ error: 'Delay must be between 0 and 300 seconds' });
    }

    // Process keywords
    if (updates.keywords) {
      updates.keywords = updates.keywords.map(k => k.toLowerCase());
    }

    Object.assign(autoResponse, updates);
    await autoResponse.save();

    await autoResponse.populate([
      { path: 'excludeContacts', select: 'username avatar' },
      { path: 'onlyForContacts', select: 'username avatar' }
    ]);

    res.json({
      message: 'Auto-response updated successfully',
      autoResponse
    });
  } catch (error) {
    console.error('Error updating auto-response:', error);
    res.status(500).json({ error: 'Failed to update auto-response' });
  }
};

// @desc    Delete auto-response
// @route   DELETE /api/auto-responses/:id
// @access  Private
const deleteAutoResponse = async (req, res) => {
  try {
    const { id } = req.params;

    const autoResponse = await AutoResponse.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!autoResponse) {
      return res.status(404).json({ error: 'Auto-response not found' });
    }

    res.json({ message: 'Auto-response deleted successfully' });
  } catch (error) {
    console.error('Error deleting auto-response:', error);
    res.status(500).json({ error: 'Failed to delete auto-response' });
  }
};

// @desc    Toggle auto-response status
// @route   PATCH /api/auto-responses/:id/toggle
// @access  Private
const toggleAutoResponse = async (req, res) => {
  try {
    const { id } = req.params;

    const autoResponse = await AutoResponse.findOne({
      _id: id,
      user: req.user._id
    });

    if (!autoResponse) {
      return res.status(404).json({ error: 'Auto-response not found' });
    }

    autoResponse.isActive = !autoResponse.isActive;
    await autoResponse.save();

    res.json({
      message: `Auto-response ${autoResponse.isActive ? 'activated' : 'deactivated'} successfully`,
      autoResponse
    });
  } catch (error) {
    console.error('Error toggling auto-response:', error);
    res.status(500).json({ error: 'Failed to toggle auto-response' });
  }
};

// @desc    Check and send auto-response (called when message is received)
// @route   POST /api/auto-responses/check
// @access  Private (Internal use)
const checkAndSendAutoResponse = async (senderId, receiverId, messageContent) => {
  try {
    // Get active auto-responses for the receiver
    const autoResponses = await AutoResponse.find({
      user: receiverId,
      isActive: true
    }).populate('excludeContacts onlyForContacts');

    if (autoResponses.length === 0) {
      return;
    }

    // Check if receiver is online/available
    const receiver = await User.findById(receiverId);
    if (!receiver || receiver.status === 'online') {
      return; // Don't send auto-response if user is online
    }

    for (const autoResponse of autoResponses) {
      try {
        // Check contact restrictions
        if (autoResponse.excludeContacts.some(contact => contact._id.toString() === senderId.toString())) {
          continue; // Skip this auto-response
        }

        if (autoResponse.onlyForContacts.length > 0 && 
            !autoResponse.onlyForContacts.some(contact => contact._id.toString() === senderId.toString())) {
          continue; // Skip this auto-response
        }

        // Check time-based rules
        if (autoResponse.timeRules.enabled && !isWithinTimeRules(autoResponse.timeRules)) {
          continue;
        }

        // Check triggers
        let shouldSend = false;

        if (autoResponse.triggers.includes('all_messages')) {
          shouldSend = true;
        } else if (autoResponse.triggers.includes('first_message')) {
          // Check if this is the first message from this sender
          const existingMessages = await Message.find({
            sender: senderId,
            receiver: receiverId
          }).limit(1);

          shouldSend = existingMessages.length === 0;
        } else if (autoResponse.triggers.includes('keywords') && autoResponse.keywords.length > 0) {
          const messageWords = messageContent.toLowerCase().split(/\s+/);
          shouldSend = autoResponse.keywords.some(keyword => 
            messageWords.some(word => word.includes(keyword))
          );
        }

        if (shouldSend) {
          // Check if we've already sent this auto-response recently (within last hour)
          const recentAutoResponse = await Message.findOne({
            sender: receiverId,
            receiver: senderId,
            content: autoResponse.message,
            createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
          });

          if (recentAutoResponse) {
            continue; // Skip to avoid spam
          }

          // Send auto-response with delay
          setTimeout(async () => {
            try {
              const autoResponseMessage = new Message({
                sender: receiverId,
                receiver: senderId,
                content: autoResponse.message,
                messageType: 'text'
              });

              await autoResponseMessage.save();

              // Update auto-response usage
              autoResponse.usageCount++;
              autoResponse.lastUsed = new Date();
              await autoResponse.save();

              // Emit socket event if available
              if (global.io) {
                global.io.to(`user_${senderId}`).emit('newMessage', autoResponseMessage);
              }
            } catch (error) {
              console.error('Error sending auto-response:', error);
            }
          }, autoResponse.delay * 1000);

          break; // Only send one auto-response per message
        }
      } catch (error) {
        console.error('Error processing auto-response:', error);
      }
    }
  } catch (error) {
    console.error('Error checking auto-responses:', error);
  }
};

// Helper function to check if current time is within time rules
const isWithinTimeRules = (timeRules) => {
  if (!timeRules.enabled) return true;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();

  // Check days of week
  if (timeRules.days && timeRules.days.length > 0) {
    if (!timeRules.days.includes(currentDayOfWeek)) {
      return false;
    }
  }

  // Check time range
  if (timeRules.startTime && timeRules.endTime) {
    const [startHour, startMinute] = timeRules.startTime.split(':').map(Number);
    const [endHour, endMinute] = timeRules.endTime.split(':').map(Number);

    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes <= endTimeMinutes) {
      // Same day range
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    } else {
      // Overnight range
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    }
  }

  return true;
};

module.exports = {
  createAutoResponse,
  getAutoResponses,
  updateAutoResponse,
  deleteAutoResponse,
  toggleAutoResponse,
  checkAndSendAutoResponse
};
