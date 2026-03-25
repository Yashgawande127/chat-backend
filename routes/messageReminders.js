const express = require('express');
const router = express.Router();
const {
  createReminder,
  getReminders,
  updateReminder,
  snoozeReminder,
  dismissReminder,
  deleteReminder,
  processDueReminders,
  getReminderStats
} = require('../controllers/messageReminderController');
const { auth } = require('../middleware/auth');

// All routes are protected
router.use(auth);

// @route   GET /api/message-reminders/stats
// @desc    Get reminder statistics
// @access  Private
router.get('/stats', getReminderStats);

// @route   POST /api/message-reminders/process
// @desc    Process due reminders (internal use)
// @access  Private
router.post('/process', processDueReminders);

// @route   POST /api/message-reminders
// @desc    Create message reminder
// @access  Private
router.post('/', createReminder);

// @route   GET /api/message-reminders
// @desc    Get user reminders
// @access  Private
router.get('/', getReminders);

// @route   PUT /api/message-reminders/:id
// @desc    Update reminder
// @access  Private
router.put('/:id', updateReminder);

// @route   PATCH /api/message-reminders/:id/snooze
// @desc    Snooze reminder
// @access  Private
router.patch('/:id/snooze', snoozeReminder);

// @route   PATCH /api/message-reminders/:id/dismiss
// @desc    Dismiss reminder
// @access  Private
router.patch('/:id/dismiss', dismissReminder);

// @route   DELETE /api/message-reminders/:id
// @desc    Delete reminder
// @access  Private
router.delete('/:id', deleteReminder);

module.exports = router;
