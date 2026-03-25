const express = require('express');
const router = express.Router();
const {
  saveMessage,
  getSavedMessages,
  removeSavedMessage,
  updateSavedMessage,
  getTags
} = require('../controllers/savedMessageController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// @route   POST /api/saved-messages
// @desc    Save a message as bookmark
// @access  Private
router.post('/', saveMessage);

// @route   GET /api/saved-messages
// @desc    Get saved messages
// @access  Private
router.get('/', getSavedMessages);

// @route   GET /api/saved-messages/tags
// @desc    Get all tags used by user
// @access  Private
router.get('/tags', getTags);

// @route   PUT /api/saved-messages/:id
// @desc    Update saved message
// @access  Private
router.put('/:id', updateSavedMessage);

// @route   DELETE /api/saved-messages/:id
// @desc    Remove saved message
// @access  Private
router.delete('/:id', removeSavedMessage);

module.exports = router;
