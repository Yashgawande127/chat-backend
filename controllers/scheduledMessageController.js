const ScheduledMessage = require('../models/ScheduledMessage');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Schedule a message
// @route   POST /api/scheduled-messages
// @access  Private
const scheduleMessage = async (req, res) => {
  try {
    const {
      receiverId,
      content,
      messageType = 'text',
      scheduledFor,
      recurring = {}
    } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (!scheduledFor) {
      return res.status(400).json({ error: 'Scheduled time is required' });
    }

    const scheduledTime = new Date(scheduledFor);
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Validate receiver if provided
    if (receiverId) {
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }
    }

    // Create scheduled message
    const scheduledMessage = new ScheduledMessage({
      sender: req.user._id,
      receiver: receiverId,
      content,
      messageType,
      scheduledFor: scheduledTime,
      recurring: recurring.enabled ? recurring : { enabled: false }
    });

    // Calculate next scheduled time for recurring messages
    if (recurring.enabled) {
      scheduledMessage.nextScheduledFor = calculateNextScheduledTime(scheduledTime, recurring);
    }

    await scheduledMessage.save();

    await scheduledMessage.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
      
    ]);

    res.status(201).json({
      message: 'Message scheduled successfully',
      scheduledMessage
    });
  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'Failed to schedule message' });
  }
};

// @desc    Get scheduled messages
// @route   GET /api/scheduled-messages
// @access  Private
const getScheduledMessages = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { sender: req.user._id };
    if (status !== 'all') {
      query.status = status;
    }

    const scheduledMessages = await ScheduledMessage.find(query)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ scheduledFor: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ScheduledMessage.countDocuments(query);

    res.json({
      scheduledMessages,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
};

// @desc    Update scheduled message
// @route   PUT /api/scheduled-messages/:id
// @access  Private
const updateScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const scheduledMessage = await ScheduledMessage.findOne({
      _id: id,
      sender: req.user._id,
      status: 'pending'
    });

    if (!scheduledMessage) {
      return res.status(404).json({ error: 'Scheduled message not found or cannot be updated' });
    }

    // Validate scheduled time if being updated
    if (updates.scheduledFor) {
      const scheduledTime = new Date(updates.scheduledFor);
      if (scheduledTime <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }
      updates.scheduledFor = scheduledTime;
    }

    // Update recurring settings
    if (updates.recurring && updates.recurring.enabled) {
      updates.nextScheduledFor = calculateNextScheduledTime(
        updates.scheduledFor || scheduledMessage.scheduledFor,
        updates.recurring
      );
    }

    Object.assign(scheduledMessage, updates);
    await scheduledMessage.save();

    await scheduledMessage.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' }
    ]);

    res.json({
      message: 'Scheduled message updated successfully',
      scheduledMessage
    });
  } catch (error) {
    console.error('Error updating scheduled message:', error);
    res.status(500).json({ error: 'Failed to update scheduled message' });
  }
};

// @desc    Cancel scheduled message
// @route   DELETE /api/scheduled-messages/:id
// @access  Private
const cancelScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const scheduledMessage = await ScheduledMessage.findOneAndUpdate(
      {
        _id: id,
        sender: req.user._id,
        status: 'pending'
      },
      { status: 'cancelled' },
      { new: true }
    );

    if (!scheduledMessage) {
      return res.status(404).json({ error: 'Scheduled message not found or already processed' });
    }

    res.json({
      message: 'Scheduled message cancelled successfully',
      scheduledMessage
    });
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled message' });
  }
};

// @desc    Process scheduled messages (called by scheduler)
// @route   POST /api/scheduled-messages/process
// @access  Private (Internal use)
const processScheduledMessages = async (req, res) => {
  try {
    const now = new Date();
    
    // Find messages that should be sent now
    const messagesToSend = await ScheduledMessage.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).populate('sender receiver');

    const results = {
      sent: 0,
      failed: 0,
      rescheduled: 0
    };

    for (const scheduledMsg of messagesToSend) {
      try {
        let sentMessage;

        // Send to individual user
        if (scheduledMsg.receiver) {
          const message = new Message({
            sender: scheduledMsg.sender._id,
            receiver: scheduledMsg.receiver._id,
            content: scheduledMsg.content,
            messageType: scheduledMsg.messageType,
            fileUrl: scheduledMsg.fileUrl,
            fileName: scheduledMsg.fileName,
            fileSize: scheduledMsg.fileSize,
            mimeType: scheduledMsg.mimeType,
            thumbnailUrl: scheduledMsg.thumbnailUrl,
            duration: scheduledMsg.duration,
            dimensions: scheduledMsg.dimensions
          });

          sentMessage = await message.save();
        }

        // Update scheduled message status
        scheduledMsg.status = 'sent';
        scheduledMsg.sentAt = now;

        // Handle recurring messages
        if (scheduledMsg.recurring.enabled) {
          const nextScheduledTime = calculateNextScheduledTime(now, scheduledMsg.recurring);
          
          if (nextScheduledTime && (!scheduledMsg.recurring.endDate || nextScheduledTime <= scheduledMsg.recurring.endDate)) {
            // Create new scheduled message for next occurrence
            const nextScheduledMsg = new ScheduledMessage({
              ...scheduledMsg.toObject(),
              _id: undefined,
              status: 'pending',
              scheduledFor: nextScheduledTime,
              sentAt: undefined,
              failureReason: undefined,
              nextScheduledFor: calculateNextScheduledTime(nextScheduledTime, scheduledMsg.recurring),
              createdAt: undefined,
              updatedAt: undefined
            });

            await nextScheduledMsg.save();
            results.rescheduled++;
          }
        }

        await scheduledMsg.save();
        results.sent++;

        // Emit socket event if available
        if (global.io && sentMessage) {
          if (scheduledMsg.receiver) {
            global.io.to(`user_${scheduledMsg.receiver._id}`).emit('newMessage', sentMessage);
          }
        }

      } catch (error) {
        console.error(`Error sending scheduled message ${scheduledMsg._id}:`, error);
        
        scheduledMsg.status = 'failed';
        scheduledMsg.failureReason = error.message;
        await scheduledMsg.save();
        
        results.failed++;
      }
    }

    res.json({
      message: 'Scheduled messages processed',
      results
    });
  } catch (error) {
    console.error('Error processing scheduled messages:', error);
    res.status(500).json({ error: 'Failed to process scheduled messages' });
  }
};

// Helper function to calculate next scheduled time for recurring messages
const calculateNextScheduledTime = (currentTime, recurring) => {
  if (!recurring.enabled) return null;

  const next = new Date(currentTime);
  const interval = recurring.interval || 1;

  switch (recurring.frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      return null;
  }

  // Handle specific days of week for weekly recurring
  if (recurring.frequency === 'weekly' && recurring.daysOfWeek && recurring.daysOfWeek.length > 0) {
    const currentDayOfWeek = next.getDay();
    const targetDays = recurring.daysOfWeek.sort();
    
    let nextDay = targetDays.find(day => day > currentDayOfWeek);
    if (!nextDay) {
      nextDay = targetDays[0];
      next.setDate(next.getDate() + 7);
    }
    
    const daysToAdd = nextDay - currentDayOfWeek;
    next.setDate(next.getDate() + daysToAdd);
  }

  // Handle specific day of month for monthly recurring
  if (recurring.frequency === 'monthly' && recurring.dayOfMonth) {
    next.setDate(recurring.dayOfMonth);
    // If the day has already passed this month, move to next month
    if (next <= currentTime) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(recurring.dayOfMonth);
    }
  }

  return next;
};

module.exports = {
  scheduleMessage,
  getScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  processScheduledMessages
};
