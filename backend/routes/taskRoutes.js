const express = require('express');
const { body, param } = require('express-validator');
const {
  getTasks,
  getTaskStats,
  getFocusTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

// Require JWT for all task routes
router.use(protect);

// Specific routes first to prevent :id conflict
router.get('/stats', getTaskStats);
router.get('/focus', getFocusTasks);

// Validation for creating/updating tasks
const taskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ max: 150 })
    .withMessage('Task title cannot exceed 150 characters'),
  body('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Completed'])
    .withMessage('Status must be Pending, In Progress, or Completed'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High'])
    .withMessage('Priority must be Low, Medium, or High'),
  validateRequest,
];

router.get('/', getTasks);
router.post('/', taskValidation, createTask);

router.get('/:id', getTaskById);
router.put('/:id', taskValidation, updateTask);
router.delete('/:id', deleteTask);

router.patch(
  '/:id/status',
  [
    body('status')
      .isIn(['Pending', 'In Progress', 'Completed'])
      .withMessage('Status must be Pending, In Progress, or Completed'),
    validateRequest,
  ],
  updateTaskStatus
);

module.exports = router;
