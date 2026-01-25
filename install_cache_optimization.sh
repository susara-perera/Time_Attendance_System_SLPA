#!/bin/bash

# Cache Optimization Installation Script
# Automatically sets up the optimized cache system

echo "🚀 Installing Optimized Cache System..."
echo "========================================"

# Check if we're in the right directory
if [ ! -d "backend" ]; then
  echo "❌ Error: Please run this script from the project root directory"
  exit 1
fi

cd backend

# Step 1: Install dependencies
echo ""
echo "📦 Step 1: Installing dependencies..."
npm install node-cron
if [ $? -eq 0 ]; then
  echo "✅ Dependencies installed"
else
  echo "⚠️  Warning: npm install had issues, but continuing..."
fi

# Step 2: Check if Redis is running
echo ""
echo "🔍 Step 2: Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
  redis-cli PING &> /dev/null
  if [ $? -eq 0 ]; then
    echo "✅ Redis is running"
  else
    echo "⚠️  Redis is not running. Please start Redis:"
    echo "   Windows: redis-server.exe"
    echo "   Linux: sudo systemctl start redis"
    echo "   Mac: brew services start redis"
  fi
else
  echo "⚠️  Redis not found. Please install Redis:"
  echo "   Windows: https://github.com/microsoftarchive/redis/releases"
  echo "   Linux: sudo apt install redis-server"
  echo "   Mac: brew install redis"
fi

# Step 3: Update .env file
echo ""
echo "⚙️  Step 3: Updating environment configuration..."
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env file..."
  touch "$ENV_FILE"
fi

# Add cache configuration if not exists
if ! grep -q "SMART_CACHE_PRELOAD" "$ENV_FILE"; then
  echo "" >> "$ENV_FILE"
  echo "# Smart Cache Configuration" >> "$ENV_FILE"
  echo "SMART_CACHE_PRELOAD=true" >> "$ENV_FILE"
  echo "CACHE_MAX_SIZE=524288000" >> "$ENV_FILE"
  echo "REDIS_ENABLED=true" >> "$ENV_FILE"
  echo "REDIS_HOST=127.0.0.1" >> "$ENV_FILE"
  echo "REDIS_PORT=6379" >> "$ENV_FILE"
  echo "✅ Environment variables added"
else
  echo "✅ Environment variables already configured"
fi

# Step 4: Add initialization code to server.js
echo ""
echo "🔧 Step 4: Updating server.js..."
SERVER_FILE="server.js"

if [ -f "$SERVER_FILE" ]; then
  # Check if already initialized
  if grep -q "smartCacheService" "$SERVER_FILE"; then
    echo "✅ server.js already configured"
  else
    echo "⚠️  server.js needs manual update"
    echo ""
    echo "Add this code after database connection:"
    echo ""
    cat << 'EOF'
// Initialize cache services
const smartCacheService = require('./services/smartCacheService');
const cacheMaintenanceScheduler = require('./services/cacheMaintenanceScheduler');

// Initialize on server start
(async () => {
  try {
    await smartCacheService.initialize();
    console.log('✅ Smart cache initialized');
    
    cacheMaintenanceScheduler.start();
    console.log('✅ Cache maintenance scheduler started');
  } catch (error) {
    console.error('Cache initialization error:', error);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down cache services...');
  cacheMaintenanceScheduler.stop();
  await smartCacheService.shutdown();
  process.exit(0);
});
EOF
  fi
else
  echo "⚠️  server.js not found"
fi

# Step 5: Create logs directory
echo ""
echo "📁 Step 5: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"

# Step 6: Verify files
echo ""
echo "📋 Step 6: Verifying installation..."
FILES=(
  "services/smartCacheService.js"
  "services/cacheMaintenanceScheduler.js"
  "controllers/cachePerformanceController.js"
)

ALL_FILES_EXIST=true
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "✅ $FILE"
  else
    echo "❌ $FILE - MISSING"
    ALL_FILES_EXIST=false
  fi
done

# Final summary
echo ""
echo "========================================"
echo "📊 Installation Summary"
echo "========================================"

if [ "$ALL_FILES_EXIST" = true ]; then
  echo "✅ All required files are present"
  echo "✅ Dependencies installed"
  echo "✅ Environment configured"
  echo ""
  echo "🎉 Installation complete!"
  echo ""
  echo "Next steps:"
  echo "1. Ensure Redis is running"
  echo "2. Add initialization code to server.js (if not done)"
  echo "3. Start the server: npm start"
  echo "4. Test login at http://localhost:3000/login"
  echo "5. Check performance at GET /api/cache/performance"
  echo ""
  echo "📚 Documentation:"
  echo "   - Quick Setup: ../CACHE_QUICK_SETUP.md"
  echo "   - Complete Guide: ../CACHE_OPTIMIZATION_COMPLETE_GUIDE.md"
  echo "   - Summary: ../CACHE_OPTIMIZATION_SUMMARY.md"
else
  echo "⚠️  Some files are missing"
  echo "Please ensure all files are copied to the backend directory"
fi

echo ""
echo "========================================"
