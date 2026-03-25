const express = require('express');
const router = express.Router();
const {
  createTemplate,
  getTemplates,
  getTemplateByShortcut,
  updateTemplate,
  deleteTemplate,
  useTemplate,
  getTemplateCategories
} = require('../controllers/messageTemplateController');
const { auth } = require('../middleware/auth');

// All routes are protected
router.use(auth);

// @route   GET /api/message-templates/categories
// @desc    Get template categories
// @access  Private
router.get('/categories', getTemplateCategories);

// @route   GET /api/message-templates/shortcut/:shortcut
// @desc    Get template by shortcut
// @access  Private
router.get('/shortcut/:shortcut', getTemplateByShortcut);

// @route   POST /api/message-templates
// @desc    Create message template
// @access  Private
router.post('/', createTemplate);

// @route   GET /api/message-templates
// @desc    Get user templates
// @access  Private
router.get('/', getTemplates);

// @route   PUT /api/message-templates/:id
// @desc    Update template
// @access  Private
router.put('/:id', updateTemplate);

// @route   DELETE /api/message-templates/:id
// @desc    Delete template
// @access  Private
router.delete('/:id', deleteTemplate);

// @route   POST /api/message-templates/:id/use
// @desc    Use template (increment usage count)
// @access  Private
router.post('/:id/use', useTemplate);

module.exports = router;
