const User = require('../models/User');

const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Study', 'Shopping', 'Projects'];

// @desc    Get all categories for current user (defaults + custom)
// @route   GET /api/categories
// @access  Private
exports.getCategories = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    const categories = user && user.customCategories && user.customCategories.length > 0
      ? user.customCategories
      : DEFAULT_CATEGORIES;

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add a custom category
// @route   POST /api/categories
// @access  Private
exports.addCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    const trimmed = name.trim();
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.customCategories) {
      user.customCategories = [...DEFAULT_CATEGORIES];
    }

    if (user.customCategories.includes(trimmed)) {
      return res.status(400).json({
        success: false,
        message: 'This category already exists',
      });
    }

    user.customCategories.push(trimmed);
    await user.save();

    res.status(201).json({
      success: true,
      message: `Category "${trimmed}" added successfully`,
      categories: user.customCategories,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a custom category
// @route   DELETE /api/categories/:name
// @access  Private
exports.deleteCategory = async (req, res, next) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.customCategories = (user.customCategories || DEFAULT_CATEGORIES).filter(
      (cat) => cat.toLowerCase() !== categoryName.toLowerCase()
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: `Category "${categoryName}" removed`,
      categories: user.customCategories,
    });
  } catch (err) {
    next(err);
  }
};
