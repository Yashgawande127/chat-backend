const express = require('express');
const router = express.Router();
const {
  createAutoResponse,
  getAutoResponses,
  updateAutoResponse,
  deleteAutoResponse,
  toggleAutoResponse
} = require('../controllers/autoResponseController');
const { auth } = require('../middleware/auth');

// All routes are protected
router.use(auth);

// @route   POST /api/auto-responses
// @desc    Create auto-response
// @access  Private
router.post('/', createAutoResponse);

// @route   GET /api/auto-responses
// @desc    Get user auto-responses
// @access  Private
router.get('/', getAutoResponses);

// @route   PUT /api/auto-responses/:id
// @desc    Update auto-response
// @access  Private
router.put('/:id', updateAutoResponse);

// @route   DELETE /api/auto-responses/:id
// @desc    Delete auto-response
// @access  Private
router.delete('/:id', deleteAutoResponse);

// @route   PATCH /api/auto-responses/:id/toggle
// @desc    Toggle auto-response status
// @access  Private
router.patch('/:id/toggle', toggleAutoResponse);

module.exports = router;
