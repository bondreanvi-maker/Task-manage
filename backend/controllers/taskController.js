const Task = require('../models/Task');
const { calculateFocusScore } = require('../services/focusScoreService');
const { handleRecurringTaskCreation } = require('../services/recurringService');

// Helper to get start and end of current day
const getDayBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// @desc    Get all tasks with filtering, search and sorting
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      search,
      status,
      priority,
      category,
      tag,
      dateFilter,
      sort = 'newest',
    } = req.query;

    const query = { userId };

    // Search by title or description
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    // Filter by status
    if (status && ['Pending', 'In Progress', 'Completed'].includes(status)) {
      query.status = status;
    }

    // Filter by priority
    if (priority && ['Low', 'Medium', 'High'].includes(priority)) {
      query.priority = priority;
    }

    // Filter by category
    if (category && category !== 'All') {
      query.category = category;
    }

    // Filter by tag
    if (tag) {
      query.tags = tag;
    }

    // Filter by date
    const now = new Date();
    const { start: todayStart, end: todayEnd } = getDayBounds(now);

    if (dateFilter === 'today') {
      query.dueDate = { $gte: todayStart, $lte: todayEnd };
    } else if (dateFilter === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { start: tomStart, end: tomEnd } = getDayBounds(tomorrow);
      query.dueDate = { $gte: tomStart, $lte: tomEnd };
    } else if (dateFilter === 'this-week') {
      const endOfWeek = new Date(todayStart);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      query.dueDate = { $gte: todayStart, $lte: endOfWeek };
    } else if (dateFilter === 'overdue') {
      query.dueDate = { $lt: todayStart };
      query.status = { $ne: 'Completed' };
    } else if (dateFilter === 'upcoming') {
      query.dueDate = { $gte: todayStart };
      query.status = { $ne: 'Completed' };
    }

    // Sort order
    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    } else if (sort === 'dueDate') {
      sortOption = { dueDate: 1, createdAt: -1 };
    } else if (sort === 'priority' || sort === 'focusScore') {
      sortOption = { focusScore: -1, createdAt: -1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const tasks = await Task.find(query).sort(sortOption);

    // Dynamic refresh of focusScore for fetched tasks in case dates shifted
    const refreshedTasks = tasks.map((t) => {
      const currentScore = calculateFocusScore(t);
      if (t.focusScore !== currentScore) {
        t.focusScore = currentScore;
        t.save().catch(() => {}); // async background sync
      }
      return t;
    });

    res.status(200).json({
      success: true,
      count: refreshedTasks.length,
      tasks: refreshedTasks,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get dashboard statistics for current user
// @route   GET /api/tasks/stats
// @access  Private
exports.getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const now = new Date();
    const { start: todayStart } = getDayBounds(now);

    const allTasks = await Task.find({ userId });

    const total = allTasks.length;
    const pending = allTasks.filter((t) => t.status === 'Pending').length;
    const inProgress = allTasks.filter((t) => t.status === 'In Progress').length;
    const completed = allTasks.filter((t) => t.status === 'Completed').length;
    const highPriority = allTasks.filter((t) => t.priority === 'High' && t.status !== 'Completed').length;
    
    const overdue = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'Completed'
    ).length;

    const dueToday = allTasks.filter((t) => {
      if (!t.dueDate || t.status === 'Completed') return false;
      const d = new Date(t.dueDate);
      return d >= todayStart && d <= new Date(todayStart.getTime() + 86400000 - 1);
    }).length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Breakdown by Category
    const categoryStats = {};
    allTasks.forEach((t) => {
      categoryStats[t.category] = (categoryStats[t.category] || 0) + 1;
    });

    // Breakdown by Priority
    const priorityStats = {
      High: allTasks.filter((t) => t.priority === 'High').length,
      Medium: allTasks.filter((t) => t.priority === 'Medium').length,
      Low: allTasks.filter((t) => t.priority === 'Low').length,
    };

    res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        inProgress,
        completed,
        overdue,
        highPriority,
        dueToday,
        completionRate,
        categoryStats,
        priorityStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Smart Focus tasks for "Focus Today" section
// @route   GET /api/tasks/focus
// @access  Private
exports.getFocusTasks = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    // Get incomplete tasks
    const incompleteTasks = await Task.find({
      userId,
      status: { $ne: 'Completed' },
    });

    // Ensure up-to-date score calculation
    incompleteTasks.forEach((t) => {
      t.focusScore = calculateFocusScore(t);
    });

    // Sort descending by focusScore
    incompleteTasks.sort((a, b) => b.focusScore - a.focusScore);

    // Return top 5 focus items
    const focusTasks = incompleteTasks.slice(0, 5);

    res.status(200).json({
      success: true,
      count: focusTasks.length,
      tasks: focusTasks,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
exports.getTaskById = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      userId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or access unauthorized.',
      });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      category,
      tags,
      dueDate,
      recurring,
    } = req.body;

    // Clean and normalize tags
    let formattedTags = [];
    if (Array.isArray(tags)) {
      formattedTags = tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string' && tags.trim()) {
      formattedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const newTask = new Task({
      userId: req.user._id || req.user.id,
      title,
      description: description || '',
      status: status || 'Pending',
      priority: priority || 'Medium',
      category: category || 'Work',
      tags: formattedTags,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      recurring: {
        enabled: Boolean(recurring && recurring.enabled),
        frequency: recurring && recurring.frequency ? recurring.frequency : 'daily',
      },
    });

    await newTask.save();

    res.status(201).json({
      success: true,
      message: 'Task created successfully!',
      task: newTask,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update task details
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      userId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or access unauthorized.',
      });
    }

    const {
      title,
      description,
      status,
      priority,
      category,
      tags,
      dueDate,
      recurring,
    } = req.body;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (category !== undefined) task.category = category;
    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
    }

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        task.tags = tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof tags === 'string') {
        task.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    if (recurring !== undefined) {
      task.recurring = {
        enabled: Boolean(recurring.enabled),
        frequency: recurring.frequency || 'daily',
      };
    }

    const previousStatus = task.status;
    let recurringCreatedTask = null;

    if (status !== undefined) {
      task.status = status;
      // Handle recurring generation if newly completed
      if (previousStatus !== 'Completed' && status === 'Completed') {
        recurringCreatedTask = await handleRecurringTaskCreation(Task, task);
      }
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: 'Task updated successfully!',
      task,
      recurringCreated: Boolean(recurringCreatedTask),
      nextTask: recurringCreatedTask,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Quick status toggle / update
// @route   PATCH /api/tasks/:id/status
// @access  Private
exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: Pending, In Progress, Completed',
      });
    }

    const userId = req.user._id || req.user.id;
    const task = await Task.findOne({
      _id: req.params.id,
      userId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or access unauthorized.',
      });
    }

    const previousStatus = task.status;
    task.status = status;

    let recurringCreatedTask = null;
    if (previousStatus !== 'Completed' && status === 'Completed') {
      recurringCreatedTask = await handleRecurringTaskCreation(Task, task);
    }

    await task.save();

    res.status(200).json({
      success: true,
      message: `Task marked as ${status}!`,
      task,
      recurringCreated: Boolean(recurringCreatedTask),
      nextTask: recurringCreatedTask,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or access unauthorized.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully!',
      taskId: req.params.id,
    });
  } catch (err) {
    next(err);
  }
};
