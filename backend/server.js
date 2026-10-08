const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
// Also check parent folder .env if not found
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows flexible CDN font/icon imports if needed
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets directly from frontend directory
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    database: 'Supabase PostgreSQL',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);

// Catch-all for API 404s
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Serve frontend index.html for root path or SPA navigation if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    // Check if initial seed is needed
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[TaskFlow] Fresh database detected. Auto-seeding initial demo data...');
      const seedSampleData = require('./utils/seed');
      await seedSampleData();
    }

    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`🚀 TaskFlow Server is running on port: ${PORT}`);
      console.log(`🌐 Frontend App:  http://localhost:${PORT}`);
      console.log(`🔗 API Base URL:  http://localhost:${PORT}/api`);
      console.log(`🩺 Health check:  http://localhost:${PORT}/api/health`);
      console.log(`🗄️  Database:     Supabase PostgreSQL`);
      console.log('====================================================');
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated.');
      });
    });
  } catch (err) {
    console.error('Fatal error starting server:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;

