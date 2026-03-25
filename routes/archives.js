const express = require('express');
const router = express.Router();
const {
  createArchive,
  getArchives,
  getArchive,
  updateArchive,
  deleteArchive,
  searchArchiveMessages
} = require('../controllers/archiveController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// @route   POST /api/archives
// @desc    Create message archive
// @access  Private
router.post('/', createArchive);

// @route   GET /api/archives
// @desc    Get user's archives
// @access  Private
router.get('/', getArchives);

// @route   GET /api/archives/:id
// @desc    Get single archive with messages
// @access  Private
router.get('/:id', getArchive);

// @route   GET /api/archives/:id/search
// @desc    Search within archive messages
// @access  Private
router.get('/:id/search', searchArchiveMessages);

// @route   PUT /api/archives/:id
// @desc    Update archive
// @access  Private
router.put('/:id', updateArchive);

// @route   DELETE /api/archives/:id
// @desc    Delete archive
// @access  Private
router.delete('/:id', deleteArchive);

module.exports = router;
