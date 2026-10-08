const express = require('express');
const { body } = require('express-validator');
const {
  getCategories,
  addCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

router.use(protect); // All category routes are protected

router.get('/', getCategories);
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Category name cannot be empty')
      .isLength({ max: 30 })
      .withMessage('Category name cannot exceed 30 characters'),
    validateRequest,
  ],
  addCategory
);
router.delete('/:name', deleteCategory);

module.exports = router;
