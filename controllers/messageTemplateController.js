const MessageTemplate = require('../models/MessageTemplate');

// @desc    Create message template
// @route   POST /api/message-templates
// @access  Private
const createTemplate = async (req, res) => {
  try {
    const {
      name,
      content,
      category = 'custom',
      tags = [],
      isPublic = false,
      shortcut
    } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Name and content are required' });
    }

    // Check if shortcut is already used by this user
    if (shortcut) {
      const existingTemplate = await MessageTemplate.findOne({
        user: req.user._id,
        shortcut: shortcut.toLowerCase()
      });

      if (existingTemplate) {
        return res.status(400).json({ error: 'Shortcut already exists' });
      }
    }

    const template = new MessageTemplate({
      user: req.user._id,
      name,
      content,
      category,
      tags: tags.map(tag => tag.toLowerCase()),
      isPublic,
      shortcut: shortcut ? shortcut.toLowerCase() : undefined
    });

    await template.save();

    res.status(201).json({
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Template with this shortcut already exists' });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
};

// @desc    Get user templates
// @route   GET /api/message-templates
// @access  Private
const getTemplates = async (req, res) => {
  try {
    const {
      category,
      search,
      includePublic = 'true',
      page = 1,
      limit = 20
    } = req.query;

    const skip = (page - 1) * limit;
    const query = {};

    // Build query
    if (includePublic === 'true') {
      query.$or = [
        { user: req.user._id },
        { isPublic: true }
      ];
    } else {
      query.user = req.user._id;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }

    const templates = await MessageTemplate.find(query)
      .populate('user', 'username avatar')
      .sort({ usageCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MessageTemplate.countDocuments(query);

    res.json({
      templates,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

// @desc    Get template by shortcut
// @route   GET /api/message-templates/shortcut/:shortcut
// @access  Private
const getTemplateByShortcut = async (req, res) => {
  try {
    const { shortcut } = req.params;

    const template = await MessageTemplate.findOne({
      $or: [
        { user: req.user._id, shortcut: shortcut.toLowerCase() },
        { isPublic: true, shortcut: shortcut.toLowerCase() }
      ]
    }).populate('user', 'username avatar');

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Error fetching template by shortcut:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
};

// @desc    Update template
// @route   PUT /api/message-templates/:id
// @access  Private
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await MessageTemplate.findOne({
      _id: id,
      user: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check shortcut uniqueness if being updated
    if (updates.shortcut && updates.shortcut !== template.shortcut) {
      const existingTemplate = await MessageTemplate.findOne({
        user: req.user._id,
        shortcut: updates.shortcut.toLowerCase(),
        _id: { $ne: id }
      });

      if (existingTemplate) {
        return res.status(400).json({ error: 'Shortcut already exists' });
      }
      updates.shortcut = updates.shortcut.toLowerCase();
    }

    // Process tags
    if (updates.tags) {
      updates.tags = updates.tags.map(tag => tag.toLowerCase());
    }

    Object.assign(template, updates);
    await template.save();

    res.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

// @desc    Delete template
// @route   DELETE /api/message-templates/:id
// @access  Private
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await MessageTemplate.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

// @desc    Use template (increment usage count)
// @route   POST /api/message-templates/:id/use
// @access  Private
const useTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await MessageTemplate.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { user: req.user._id },
          { isPublic: true }
        ]
      },
      { $inc: { usageCount: 1 } },
      { new: true }
    ).populate('user', 'username avatar');

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      message: 'Template usage recorded',
      template
    });
  } catch (error) {
    console.error('Error recording template usage:', error);
    res.status(500).json({ error: 'Failed to record template usage' });
  }
};

// @desc    Get template categories
// @route   GET /api/message-templates/categories
// @access  Private
const getTemplateCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'greeting', label: 'Greetings', icon: '👋' },
      { value: 'farewell', label: 'Farewells', icon: '👋' },
      { value: 'business', label: 'Business', icon: '💼' },
      { value: 'personal', label: 'Personal', icon: '😊' },
      { value: 'emergency', label: 'Emergency', icon: '🚨' },
      { value: 'custom', label: 'Custom', icon: '⚙️' }
    ];

    // Get count for each category for current user
    const categoryCounts = await MessageTemplate.aggregate([
      {
        $match: {
          $or: [
            { user: req.user._id },
            { isPublic: true }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = Object.fromEntries(
      categoryCounts.map(item => [item._id, item.count])
    );

    const categoriesWithCounts = categories.map(category => ({
      ...category,
      count: countMap[category.value] || 0
    }));

    res.json({ categories: categoriesWithCounts });
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({ error: 'Failed to fetch template categories' });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplateByShortcut,
  updateTemplate,
  deleteTemplate,
  useTemplate,
  getTemplateCategories
};
