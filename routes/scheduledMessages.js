const express = require('express');
const router = express.Router();
const {
  scheduleMessage,
  getScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
  processScheduledMessages
} = require('../controllers/scheduledMessageController');
const { auth } = require('../middleware/auth');

// All routes are protected
router.use(auth);

// @route   POST /api/scheduled-messages
// @desc    Schedule a message
// @access  Private
router.post('/', scheduleMessage);

// @route   GET /api/scheduled-messages
// @desc    Get scheduled messages
// @access  Private
router.get('/', getScheduledMessages);

// @route   PUT /api/scheduled-messages/:id
// @desc    Update scheduled message
// @access  Private
router.put('/:id', updateScheduledMessage);

// @route   DELETE /api/scheduled-messages/:id
// @desc    Cancel scheduled message
// @access  Private
router.delete('/:id', cancelScheduledMessage);

// @route   POST /api/scheduled-messages/process
// @desc    Process scheduled messages (internal use)
// @access  Private
router.post('/process', processScheduledMessages);

module.exports = router;
