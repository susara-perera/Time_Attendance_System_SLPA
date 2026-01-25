const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Remove MongoDB - using MySQL only
// const connectDB = require('./config/database');
const { testMySQLConnection, ensureMySQLSchema } = require('./config/mysql');
const { sequelize } = require('./config/mysql');

const app = express();

// Initialize MySQL and sync models
const initializeMySQL = async () => {
  try {
    console.log('🔄 Connecting to MySQL database...');
    await testMySQLConnection();
    console.log('✅ MySQL connection established');
    
    // Initialize models and associations
    require('./models/mysql');
    
    // Don't sync - tables already exist in MySQL, we're just using them
    // await sequelize.sync({ alter: false, force: false }); 
    console.log('✅ MySQL models loaded');
    
    // Ensure schema exists
    await ensureMySQLSchema();
    console.log('✅ MySQL schema verified');
    
    // Seed roles
    await seedRoles();
    
    // Create default super admin
    await createDefaultSuperAdmin();
    
  } catch (error) {
    console.error('❌ Failed to initialize MySQL:', error.message);
    process.exit(1);
  }
};

// Seed default roles in MySQL
const seedRoles = async () => {
  try {
    console.log('🌱 Seeding roles in MySQL...');
    const { MySQLRole } = require('./models/mysql');
    const defaultRoles = [
      { value: 'super_admin', label: 'Super Admin', name: 'Super Admin', description: 'Highest level system administrator', permissions: {} },
      { value: 'admin', label: 'Administrator', name: 'Administrator', description: 'System administrator with management rights', permissions: {} },
      { value: 'administrative_clerk', label: 'Administrative Clerk', name: 'Administrative Clerk', description: 'Administrative support staff', permissions: {} },
      { value: 'clerk', label: 'Clerk', name: 'Clerk', description: 'General office clerk', permissions: {} },
      { value: 'employee', label: 'Employee', name: 'Employee', description: 'Regular system user', permissions: {} }
    ];

    for (const roleData of defaultRoles) {
      await MySQLRole.findOrCreate({
        where: { value: roleData.value },
        defaults: roleData
      });
    }
    console.log('✅ Roles seeded successfully in MySQL');
  } catch (err) {
    console.error('❌ Error seeding roles:', err.message);
    // Don't fail the server if role seeding fails
  }
};

// Create default super admin user
const createDefaultSuperAdmin = async () => {
  try {
    console.log('👤 Checking for default super admin...');
    const { MySQLUser } = require('./models/mysql');
    
    const existingAdmin = await MySQLUser.findOne({ where: { email: 'root@slpa.lk' } });
    
    if (!existingAdmin) {
      console.log('🔧 Creating default super admin user...');
      await MySQLUser.create({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'root@slpa.lk',
        employeeId: 'ROOT001',
        password: 'root123', // Will be hashed by beforeSave hook
        role: 'super_admin',
        divisionId: 66, // IS division
        sectionId: 333, // IS section
        isActive: true,
        permissions: {
          users: { create: true, read: true, update: true, delete: true },
          attendance: { create: true, read: true, update: true, delete: true },
          reports: { create: true, read: true, update: true, delete: true },
          divisions: { create: true, read: true, update: true, delete: true },
          settings: { create: true, read: true, update: true, delete: true }
        }
      });
      console.log('✅ Default super admin created');
      console.log('   Email: root@slpa.lk');
      console.log('   Password: root123');
      console.log('   Division ID: 66 (IS)');
      console.log('   Section ID: 333 (IS)');
    } else {
      console.log('ℹ️  Super admin user already exists');
    }
  } catch (err) {
    console.error('❌ Error creating default super admin:', err.message);
  }
};

// Initialize MySQL on startup
initializeMySQL();

console.log('🛑 HRIS sync scheduler DISABLED - no automatic sync processes');

// Cache system removed - using direct MySQL queries from sync tables

// Initialize performance monitoring
const performanceMonitor = require('./middleware/performanceMonitor');

console.log('✅ System ready - Using MySQL sync tables for data access');
console.log('🚀 Users can now login');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Trust proxy for rate limiting to work properly
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 100 attempts for development
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization
app.use(xss()); // Prevent XSS attacks

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Performance monitoring middleware (after logging)
app.use(performanceMonitor.middleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    dataSource: 'MySQL Sync Tables',
    syncSchedule: 'Daily at 12:00 PM'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user')); // USER CRUD OPERATIONS ENABLED
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/divisions', require('./routes/division'));
app.use('/api/sections', require('./routes/section'));
app.use('/api/employees', require('./routes/employee'));
app.use('/api/meals', require('./routes/meal'));
// Sub-sections routes (list/create/update/delete)
app.use('/api/subsections', require('./routes/mysqlSubSection'));
// MySQL-backed reports (audit, attendance, meal) mounted separately
app.use('/api/reports/mysql', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/mysql', require('./routes/mysql'));
app.use('/api/mysql-data', require('./routes/mysqlData'));
app.use('/api/roles', require('./routes/role'));
app.use('/api/permissions', require('./routes/permission'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/quick-stats', require('./routes/quickStats')); // Progressive dashboard stats
// Performance testing route (internal testing from same process)
app.use('/api/performance-test', require('./routes/performanceTest'));
app.use('/api/mysql-subsections', require('./routes/mysqlSubSection'));
app.use('/api/hris-cache', require('./routes/hrisCache'));
// MySQL-based subsection transfer endpoints
app.use('/api/mysql-subsections', require('./routes/mysqlSubSectionTransfer'));
// MySQL Activity routes (recent activities with auto cleanup)
app.use('/api/mysql-activities', require('./routes/mysqlActivity'));
app.use('/api/hris', require('./routes/hris'));
// HRIS Sync routes
app.use('/api/sync', require('./routes/sync'));
// MySQL Data routes (fast synced data access)
app.use('/api/mysql-data', require('./routes/mysqlData'));
// Performance monitoring and testing routes
app.use('/api/performance', require('./routes/performance'));

const activityRoutes = require('./routes/activity');
const reportRoutes = require('./routes/report');
const divisionRoutes = require('./routes/division');

app.use('/api/activities', activityRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/divisions', divisionRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  
  // Serve static files from React build
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'Field';
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

// process.on('SIGINT', () => {
//   console.log('SIGINT received. Shutting down gracefully...');
//   process.exit(0);
// });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

console.log(`🔧 Attempting to start server on port ${PORT}...`);
console.log(`🔧 Current directory: ${__dirname}`);
console.log(`🔧 Express app routes count: ${app._router ? app._router.stack.length : 'unknown'}`);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server ACTUALLY listening on port ${PORT}`);
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`📊 Data Source: MySQL Sync Tables (divisions_sync, sections_sync, employees_sync, sub_sections)`);
  console.log('ℹ️  Dashboard totals cache sync is manual (via Manual Sync page)');
  console.log(`📍 Health check available at http://localhost:${PORT}/health`);
  console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
  
  // Verify server is listening
  const address = server.address();
  console.log(`🔍 Server bound to: ${JSON.stringify(address)}`);
  
  // Run internal performance test after 3 seconds
  setTimeout(async () => {
    console.log('\n🧪 Running internal performance tests...\n');
    try {
      const axios = require('axios');
      const response = await axios.get(`http://localhost:${PORT}/api/performance-test/internal-test`, {
        timeout: 60000
      });
      
      console.log('\n📊 PERFORMANCE TEST RESULTS:');
      console.log('='.repeat(50));
      response.data.results.tests.forEach(test => {
        const statusIcon = test.status === 'SUCCESS' ? '✅' : '❌';
        console.log(`${statusIcon} ${test.name}: ${test.time || 'N/A'}ms`);
        if (test.improvement) console.log(`   ${test.improvement}`);
        if (test.user) console.log(`   User: ${test.user}`);
        if (test.count) console.log(`   Count: ${test.count}`);
        if (test.error) console.log(`   Error: ${test.error}`);
      });
      console.log('='.repeat(50));
      if (response.data.summary && response.data.summary.averageTime) {
        console.log(`📈 Average: ${response.data.summary.averageTime}ms\n`);
      } else {
        console.log(`⚠️  Performance test completed with errors\n`);
      }
    } catch (err) {
      console.error('\n❌ Internal performance test failed:', err.message);
    }
  }, 3000);
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ SERVER ERROR OCCURRED:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Unknown server error:', err);
    process.exit(1);
  }
});

module.exports = app;
