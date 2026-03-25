const MessageReminder = require('../models/MessageReminder');
const User = require('../models/User');

// @desc    Create message reminder
// @route   POST /api/message-reminders
// @access  Private
const createReminder = async (req, res) => {
  try {
    const {
      contactId,
      message,
      reminderFor,
      type = 'custom',
      priority = 'medium',
      recurring = {}
    } = req.body;

    if (!contactId || !message || !reminderFor) {
      return res.status(400).json({ error: 'Contact ID, message, and reminder time are required' });
    }

    const reminderTime = new Date(reminderFor);
    if (reminderTime <= new Date()) {
      return res.status(400).json({ error: 'Reminder time must be in the future' });
    }

    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const reminder = new MessageReminder({
      user: req.user._id,
      contact: contactId,
      message,
      reminderFor: reminderTime,
      type,
      priority,
      recurring: recurring.enabled ? recurring : { enabled: false }
    });

    // Calculate next reminder date for recurring reminders
    if (recurring.enabled) {
      reminder.nextReminderDate = calculateNextReminderDate(reminderTime, recurring);
    }

    await reminder.save();

    await reminder.populate('contact', 'username avatar');

    res.status(201).json({
      message: 'Reminder created successfully',
      reminder
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
};

// @desc    Get user reminders
// @route   GET /api/message-reminders
// @access  Private
const getReminders = async (req, res) => {
  try {
    const {
      status = 'pending',
      type,
      priority,
      upcoming = 'false',
      page = 1,
      limit = 10
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { user: req.user._id };

    if (status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    // Filter for upcoming reminders (next 7 days)
    if (upcoming === 'true') {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.reminderFor = { $gte: now, $lte: nextWeek };
      query.status = 'pending';
    }

    const reminders = await MessageReminder.find(query)
      .populate('contact', 'username avatar')
      .sort({ reminderFor: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MessageReminder.countDocuments(query);

    res.json({
      reminders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
};

// @desc    Update reminder
// @route   PUT /api/message-reminders/:id
// @access  Private
const updateReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const reminder = await MessageReminder.findOne({
      _id: id,
      user: req.user._id,
      status: { $in: ['pending', 'snoozed'] }
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found or cannot be updated' });
    }

    // Validate reminder time if being updated
    if (updates.reminderFor) {
      const reminderTime = new Date(updates.reminderFor);
      if (reminderTime <= new Date()) {
        return res.status(400).json({ error: 'Reminder time must be in the future' });
      }
      updates.reminderFor = reminderTime;
    }

    // Update recurring settings
    if (updates.recurring && updates.recurring.enabled) {
      updates.nextReminderDate = calculateNextReminderDate(
        updates.reminderFor || reminder.reminderFor,
        updates.recurring
      );
    }

    Object.assign(reminder, updates);
    await reminder.save();

    await reminder.populate('contact', 'username avatar');

    res.json({
      message: 'Reminder updated successfully',
      reminder
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
};

// @desc    Snooze reminder
// @route   PATCH /api/message-reminders/:id/snooze
// @access  Private
const snoozeReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const { snoozeFor } = req.body; // Duration in minutes

    if (!snoozeFor || snoozeFor < 1) {
      return res.status(400).json({ error: 'Valid snooze duration is required' });
    }

    const reminder = await MessageReminder.findOne({
      _id: id,
      user: req.user._id,
      status: 'pending'
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const snoozeUntil = new Date(Date.now() + snoozeFor * 60 * 1000);
    
    reminder.status = 'snoozed';
    reminder.snoozeUntil = snoozeUntil;
    reminder.reminderFor = snoozeUntil;
    
    await reminder.save();
    await reminder.populate('contact', 'username avatar');

    res.json({
      message: 'Reminder snoozed successfully',
      reminder
    });
  } catch (error) {
    console.error('Error snoozing reminder:', error);
    res.status(500).json({ error: 'Failed to snooze reminder' });
  }
};

// @desc    Dismiss reminder
// @route   PATCH /api/message-reminders/:id/dismiss
// @access  Private
const dismissReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await MessageReminder.findOne({
      _id: id,
      user: req.user._id,
      status: { $in: ['pending', 'snoozed'] }
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    reminder.status = 'dismissed';
    await reminder.save();

    res.json({
      message: 'Reminder dismissed successfully',
      reminder
    });
  } catch (error) {
    console.error('Error dismissing reminder:', error);
    res.status(500).json({ error: 'Failed to dismiss reminder' });
  }
};

// @desc    Delete reminder
// @route   DELETE /api/message-reminders/:id
// @access  Private
const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await MessageReminder.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
};

// @desc    Process due reminders (called by scheduler)
// @route   POST /api/message-reminders/process
// @access  Private (Internal use)
const processDueReminders = async (req, res) => {
  try {
    const now = new Date();
    
    // Find reminders that are due
    const dueReminders = await MessageReminder.find({
      $or: [
        { status: 'pending', reminderFor: { $lte: now } },
        { status: 'snoozed', snoozeUntil: { $lte: now } }
      ]
    }).populate('user contact');

    const results = {
      processed: 0,
      failed: 0,
      rescheduled: 0
    };

    for (const reminder of dueReminders) {
      try {
        // Send notification (this would integrate with your notification system)
        if (global.io) {
          global.io.to(`user_${reminder.user._id}`).emit('reminderDue', {
            id: reminder._id,
            message: reminder.message,
            contact: {
              id: reminder.contact._id,
              username: reminder.contact.username,
              avatar: reminder.contact.avatar
            },
            type: reminder.type,
            priority: reminder.priority
          });
        }

        // Update reminder status
        reminder.status = 'sent';
        reminder.sentAt = now;
        reminder.notificationSent = true;

        // Handle recurring reminders
        if (reminder.recurring.enabled && reminder.nextReminderDate) {
          // Create new reminder for next occurrence
          const nextReminder = new MessageReminder({
            user: reminder.user._id,
            contact: reminder.contact._id,
            message: reminder.message,
            reminderFor: reminder.nextReminderDate,
            type: reminder.type,
            priority: reminder.priority,
            recurring: reminder.recurring,
            nextReminderDate: calculateNextReminderDate(reminder.nextReminderDate, reminder.recurring)
          });

          await nextReminder.save();
          results.rescheduled++;
        }

        await reminder.save();
        results.processed++;

      } catch (error) {
        console.error(`Error processing reminder ${reminder._id}:`, error);
        results.failed++;
      }
    }

    res.json({
      message: 'Due reminders processed',
      results
    });
  } catch (error) {
    console.error('Error processing due reminders:', error);
    res.status(500).json({ error: 'Failed to process due reminders' });
  }
};

// @desc    Get reminder statistics
// @route   GET /api/message-reminders/stats
// @access  Private
const getReminderStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await MessageReminder.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await MessageReminder.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await MessageReminder.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get upcoming reminders count (next 7 days)
    const upcomingCount = await MessageReminder.countDocuments({
      user: userId,
      status: 'pending',
      reminderFor: {
        $gte: new Date(),
        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      statusStats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      typeStats: typeStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      priorityStats: priorityStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      upcomingCount
    });
  } catch (error) {
    console.error('Error fetching reminder stats:', error);
    res.status(500).json({ error: 'Failed to fetch reminder statistics' });
  }
};

// Helper function to calculate next reminder date for recurring reminders
const calculateNextReminderDate = (currentDate, recurring) => {
  if (!recurring.enabled) return null;

  const next = new Date(currentDate);
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

  return next;
};

module.exports = {
  createReminder,
  getReminders,
  updateReminder,
  snoozeReminder,
  dismissReminder,
  deleteReminder,
  processDueReminders,
  getReminderStats
};
