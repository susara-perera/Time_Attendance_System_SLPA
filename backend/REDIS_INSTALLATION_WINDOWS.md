# 🔧 REDIS INSTALLATION GUIDE FOR WINDOWS

## ✅ CACHE SYSTEM STATUS

**Implementation:** ✅ COMPLETE  
**Redis Package:** ✅ INSTALLED  
**Testing:** ⏳ Pending Redis server installation

---

## 📦 OPTION 1: Windows Installer (Recommended)

### **Step 1: Download Redis for Windows**

**Official Microsoft Archive:**
- URL: https://github.com/microsoftarchive/redis/releases
- Download: **Redis-x64-3.0.504.msi** (latest stable)
- Size: ~5 MB

### **Step 2: Install Redis**

1. Run the MSI installer
2. Accept defaults (installation path: `C:\Program Files\Redis`)
3. Check ☑️ "Add the Redis installation folder to the PATH environment variable"
4. Complete installation

### **Step 3: Start Redis Server**

**Option A: Windows Service (Auto-start)**
```cmd
# Already running as service after install
# Check status:
sc query Redis
```

**Option B: Manual Start**
```cmd
# Navigate to Redis directory
cd "C:\Program Files\Redis"

# Start server
redis-server.exe redis.windows.conf
```

### **Step 4: Verify Installation**

Open new terminal:
```cmd
redis-cli ping
```

Expected output: **PONG**

---

## 📦 OPTION 2: Docker (Alternative)

If Docker is installed:

```bash
# Pull and run Redis
docker run -d -p 6379:6379 --name redis-cache redis:latest

# Verify
docker ps

# Test connection
docker exec -it redis-cache redis-cli ping
```

**Stop Redis:**
```bash
docker stop redis-cache
```

**Start Redis:**
```bash
docker start redis-cache
```

---

## 📦 OPTION 3: WSL2 (Linux on Windows)

If WSL2 is installed:

```bash
# Open WSL2 terminal
wsl

# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Verify
redis-cli ping
```

---

## 📦 OPTION 4: Memurai (Redis Alternative for Windows)

**Memurai** is a Redis-compatible server optimized for Windows:

1. Download: https://www.memurai.com/get-memurai
2. Install: Memurai-Developer (free)
3. Start: Windows Service automatically starts
4. Test: `redis-cli ping` → PONG

---

## ⚙️ BACKEND CONFIGURATION

After installing Redis, configure in `.env`:

```env
# Redis Cache Configuration
REDIS_ENABLED=true           # Enable cache
REDIS_HOST=127.0.0.1         # Localhost
REDIS_PORT=6379              # Default Redis port
REDIS_PASSWORD=              # Leave empty (no auth by default)
REDIS_DB=0                   # Database 0
CACHE_TTL=300                # 5 minutes cache
```

---

## 🧪 TEST INSTALLATION

### **1. Test Redis Connection**

```cmd
redis-cli ping
```
Expected: `PONG`

### **2. Test Backend Cache**

```bash
cd backend
node test_cache_system.js
```

Expected output:
```
STEP 1: Connecting to Redis cache...
✅ Redis connected

STEP 3: First report generation (NO CACHE)
✅ First request completed in 5234ms

STEP 4: Second report generation (FROM CACHE)
✅ Second request completed in 47ms

Performance Improvement: 99.1% faster
```

### **3. Start Backend Server**

```bash
npm start
```

Expected log:
```
🔌 Connecting to Redis cache...
✅ Redis cache connected
📊 Reports will use caching for instant responses
```

---

## 🛠️ TROUBLESHOOTING

### **Issue: "redis-cli not found"**

**Solution:** Add Redis to PATH:
1. Right-click "This PC" → Properties
2. Advanced system settings → Environment Variables
3. Edit "Path" → New → Add: `C:\Program Files\Redis`
4. Restart terminal

### **Issue: "Connection refused 127.0.0.1:6379"**

**Solution:** Start Redis server:
```cmd
cd "C:\Program Files\Redis"
redis-server.exe
```

Or start Windows service:
```cmd
net start Redis
```

### **Issue: "Redis service won't start"**

**Solution:** Check if port 6379 is in use:
```cmd
netstat -ano | findstr :6379
```

If port is occupied, kill the process or use different port:
```env
REDIS_PORT=6380
```

### **Issue: "Error loading dump.rdb"**

**Solution:** Delete corrupted dump file:
```cmd
cd "C:\Program Files\Redis"
del dump.rdb
redis-server.exe redis.windows.conf
```

---

## 📊 REDIS COMMANDS CHEAT SHEET

### **Basic Operations**

```bash
# Start server
redis-server

# Test connection
redis-cli ping

# Connect to Redis CLI
redis-cli

# View all keys
KEYS *

# View report cache keys
KEYS report:*

# Get cache value
GET "report:group:2026-01-01:2026-01-07:::"

# Delete key
DEL "report:group:2026-01-01:2026-01-07:::"

# Clear all cache
FLUSHDB

# Get stats
INFO stats
INFO memory

# Monitor live activity
MONITOR
```

---

## 🎯 NEXT STEPS

1. ✅ Install Redis using one of the options above
2. ✅ Verify connection: `redis-cli ping`
3. ✅ Configure `.env` with Redis settings
4. ✅ Run test: `node backend/test_cache_system.js`
5. ✅ Start backend: `npm start`
6. ✅ Test API with cache: Generate same report twice

---

## 📞 QUICK START COMMANDS

```bash
# After installation, run these in order:

# 1. Test Redis
redis-cli ping

# 2. Test cache system
cd backend
node test_cache_system.js

# 3. Start backend with cache
npm start

# 4. Monitor cache activity (separate terminal)
redis-cli MONITOR
```

---

## ✅ SYSTEM STATUS

- [x] Cache module created (`reportCache.js`)
- [x] Cache integrated in report controller
- [x] Cache management API created (8 endpoints)
- [x] Server configured for cache initialization
- [x] Test suite created (`test_cache_system.js`)
- [x] Redis npm package installed
- [ ] **Redis server installation** ← YOU ARE HERE
- [ ] Run cache tests
- [ ] Deploy to production

---

**Installation Time:** ~5 minutes  
**Difficulty:** ⭐⭐ (Easy)  
**Required:** For instant report responses  

**Choose Option 1 (Windows Installer) for simplest setup!**
