const dotenv = require('dotenv');
const path = require('path');
const User = require('../models/User');
const Task = require('../models/Task');
const { connectDB, disconnectDB } = require('../config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedSampleData = async () => {
  try {
    console.log('[Seeder] Initializing database connection...');
    await connectDB();

    // Check if demo user already exists
    const demoEmail = 'demo@taskflow.dev';
    let user = await User.findOne({ email: demoEmail });

    if (user) {
      console.log('[Seeder] Cleaning existing demo tasks...');
      await Task.deleteMany({ userId: user._id || user.id });
    } else {
      console.log('[Seeder] Creating demo user...');
      user = await User.create({
        name: 'Alex Johnson',
        email: demoEmail,
        password: 'password123',
        customCategories: ['Work', 'Personal', 'Study', 'Shopping', 'Projects', 'Health'],
      });
    }

    console.log(`[Seeder] Seeding tasks for user: ${user.name} (${user.email})...`);

    const now = new Date();
    
    // Dates relative to today
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const today = new Date(now);
    today.setHours(18, 0, 0, 0);

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);

    const inThreeDays = new Date(now);
    inThreeDays.setDate(now.getDate() + 3);

    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);

    const nextMonth = new Date(now);
    nextMonth.setDate(now.getDate() + 25);

    const sampleTasks = [
      {
        userId: user._id || user.id,
        title: 'Submit quarterly budget report to executive team',
        description: 'Compile financial reports, expense breakdowns, and future projections for Q4.',
        status: 'In Progress',
        priority: 'High',
        category: 'Work',
        tags: ['Finance', 'Urgent', 'Q4'],
        dueDate: tomorrow.toISOString(),
        recurring: { enabled: false },
      },
      {
        userId: user._id || user.id,
        title: 'Review team pull requests and merge release branch',
        description: 'Audit critical bug fixes, check CI/CD pipeline results, and verify staging tests.',
        status: 'Pending',
        priority: 'High',
        category: 'Projects',
        tags: ['CodeReview', 'Release', 'Backend'],
        dueDate: today.toISOString(),
        recurring: { enabled: true, frequency: 'daily' },
      },
      {
        userId: user._id || user.id,
        title: 'Prepare presentation slides for AI & Design workshop',
        description: 'Create 15 interactive slides covering UX patterns and modern web development.',
        status: 'Pending',
        priority: 'Medium',
        category: 'Study',
        tags: ['Presentation', 'AI', 'Design'],
        dueDate: inThreeDays.toISOString(),
        recurring: { enabled: false },
      },
      {
        userId: user._id || user.id,
        title: 'Fix responsive navigation drawer alignment on mobile',
        description: 'Address header bar overlap on viewport width < 768px in the CSS stylesheet.',
        status: 'Pending',
        priority: 'High',
        category: 'Projects',
        tags: ['Frontend', 'Bug', 'CSS'],
        dueDate: yesterday.toISOString(), // Overdue task to test overdue logic
        recurring: { enabled: false },
      },
      {
        userId: user._id || user.id,
        title: 'Weekly grocery restock and meal preparation',
        description: 'Fresh vegetables, organic fruits, oats, and dairy supplies for the week.',
        status: 'Completed',
        priority: 'Low',
        category: 'Shopping',
        tags: ['Groceries', 'Home'],
        dueDate: yesterday.toISOString(),
        recurring: { enabled: true, frequency: 'weekly' },
      },
      {
        userId: user._id || user.id,
        title: 'Complete 45-minute cardiovascular workout',
        description: 'High-intensity interval training or 5km outdoor run.',
        status: 'In Progress',
        priority: 'Medium',
        category: 'Health',
        tags: ['Fitness', 'Cardio'],
        dueDate: today.toISOString(),
        recurring: { enabled: true, frequency: 'daily' },
      },
      {
        userId: user._id || user.id,
        title: 'Plan roadmap for next quarter feature releases',
        description: 'Draft OKRs, prioritize user feedback tickets, and draft architecture spec.',
        status: 'Pending',
        priority: 'Medium',
        category: 'Work',
        tags: ['Planning', 'Roadmap'],
        dueDate: nextWeek.toISOString(),
        recurring: { enabled: false },
      },
      {
        userId: user._id || user.id,
        title: 'Read 2 chapters of "Designing Data-Intensive Applications"',
        description: 'Focus on replication, partition strategies, and distributed transactions.',
        status: 'Pending',
        priority: 'Low',
        category: 'Study',
        tags: ['Reading', 'Architecture'],
        dueDate: nextMonth.toISOString(),
        recurring: { enabled: false },
      },
      {
        userId: user._id || user.id,
        title: 'Setup PostgreSQL database backup automation script',
        description: 'Configure automated pg_dump schedules and encrypted remote snapshots.',
        status: 'Completed',
        priority: 'Medium',
        category: 'Work',
        tags: ['DevOps', 'PostgreSQL', 'Database'],
        dueDate: yesterday.toISOString(),
        recurring: { enabled: false },
      },
    ];

    for (const taskData of sampleTasks) {
      const task = new Task(taskData);
      await task.save();
    }

    console.log(`[Seeder] Successfully seeded ${sampleTasks.length} sample tasks!`);
    console.log('----------------------------------------------------');
    console.log('Demo Login Credentials:');
    console.log('Email:    demo@taskflow.dev');
    console.log('Password: password123');
    console.log('----------------------------------------------------');

    return { user, sampleTasks };
  } catch (err) {
    console.error('[Seeder] Error seeding data:', err);
    throw err;
  }
};

if (require.main === module) {
  seedSampleData()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = seedSampleData;
