# 🚀 Redis Caching & Performance Monitoring System

## Overview
Comprehensive Redis caching and performance monitoring system to dramatically increase data fetching speed across the entire Time & Attendance System.

## 🎯 Features

### 1. Redis Caching Service
- **Automatic caching** for all major data operations
- **Smart invalidation** when data changes
- **Performance tracking** built-in
- **Graceful fallback** if Redis unavailable

### 2. Performance Monitoring
- **Real-time request timing**
- **Cache hit/miss tracking**
- **Slow request detection** (>1000ms)
- **Endpoint-specific statistics**

## 📊 Performance Testing Endpoints

### Get Overall Performance Stats
```http
GET /api/performance/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": {
      "totalRequests": 1523,
      "avgResponseTime": "125.45ms",
      "minResponseTime": "12.30ms",
      "maxResponseTime": "1245.67ms",
      "cacheHitRate": "78.50%",
      "cacheHits": 1196,
      "cacheMisses": 327,
      "slowRequests": 15,
      "slowRequestRate": "0.98%"
    },
    "cache": {
      "isConnected": true,
      "hits": 1196,
      "misses": 327,
      "sets": 450,
      "deletes": 23,
      "hitRate": "78.50%",
      "avgRetrieveTime": "8.45ms",
      "avgSaveTime": "15.23ms"
    }
  }
}
```

### Get Performance by Endpoint
```http
GET /api/performance/endpoints
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "endpoint": "GET /api/dashboard/stats",
      "requests": 234,
      "avgTime": "45.23ms",
      "minTime": "12.30ms",
      "maxTime": "156.78ms",
      "cacheHitRate": "95.30%",
      "slowRequests": 0
    },
    {
      "endpoint": "GET /api/reports/attendance/individual",
      "requests": 145,
      "avgTime": "234.56ms",
      "minTime": "45.67ms",
      "maxTime": "1234.56ms",
      "cacheHitRate": "67.59%",
      "slowRequests": 12
    }
  ]
}
```

### Get Slow Requests
```http
GET /api/performance/slow-requests?limit=50
Authorization: Bearer {token}
```

### Test Dashboard Performance
```http
POST /api/performance/test/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": {
      "cached": {
        "stats": 8,
        "activities": 12,
        "total": 20,
        "dataFound": true
      },
      "fresh": {
        "total": 456,
        "dataFound": true
      }
    },
    "speedup": "22.80x faster",
    "totalTestTime": "523ms",
    "recommendation": "Cache is working optimally"
  }
}
```

### Test Report Performance
```http
POST /api/performance/test/reports
Authorization: Bearer {token}
Content-Type: application/json

{
  "employeeId": "465963",
  "startDate": "2026-01-22",
  "endDate": "2026-01-22"
}
```

## 🔧 Redis Cache Keys Structure

### Dashboard
```
dashboard:stats                    - Dashboard statistics
dashboard:activities:50            - Recent activities (50 items)
```

### Employees
```
employees:all                      - All employees
employee:{id}                      - Specific employee
employees:division:{divisionId}    - Employees by division
employees:section:{sectionId}      - Employees by section
```

### Divisions
```
divisions:all                      - All divisions
division:{id}                      - Specific division
```

### Sections
```
sections:all                       - All sections
section:{id}                       - Specific section
sections:division:{divisionId}     - Sections by division
```

### Sub-Sections
```
subsections:all                    - All sub-sections
subsection:{id}                    - Specific sub-section
subsections:section:{sectionId}    - Sub-sections by section
```

### Attendance
```
attendance:{date}                              - Daily attendance
attendance:emp:{empId}:{start}:{end}          - Employee attendance range
attendance:div:{divId}:{date}                 - Division attendance
```

### Reports
```
report:individual:{empId}:{start}:{end}       - Individual report
report:group:{divId}:{secId}:{start}:{end}    - Group report
report:audit:{start}:{end}:{filters}          - Audit report
```

### IS Division Specific
```
is:employees                       - IS division employees
is:attendance:{date}               - IS division attendance
```

## 💾 Cache TTL (Time To Live)

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Dashboard Stats | 5 minutes | Frequently updated |
| Recent Activities | 2 minutes | Real-time data |
| Employees | 30 minutes | Changes infrequently |
| Divisions | 1 hour | Rarely changes |
| Sections | 1 hour | Rarely changes |
| Sub-sections | 1 hour | Rarely changes |
| Attendance (Today) | 5 minutes | Updates throughout day |
| Attendance (Past) | 24 hours | Historical data |
| Reports | 15 minutes | Balance between freshness and performance |

## 🔄 Cache Invalidation

### Automatic Invalidation
Cache is automatically invalidated when:
- Employee data is synced
- Division/Section data is synced
- Attendance data is synced
- Manual sync operations are performed

### Manual Invalidation
```javascript
// Invalidate employees cache
await redisCacheService.invalidateEmployees();

// Invalidate divisions cache
await redisCacheService.invalidateDivisions();

// Invalidate sections cache
await redisCacheService.invalidateSections();

// Invalidate attendance for specific date
await redisCacheService.invalidateAttendance('2026-01-22');

// Invalidate all attendance
await redisCacheService.invalidateAttendance();

// Invalidate all reports
await redisCacheService.invalidateReports();
```

## 📈 Expected Performance Improvements

### Before Caching
- Dashboard Load: 500-800ms
- Individual Report: 300-1200ms
- Group Report: 800-3000ms
- Employee List: 200-500ms
- Division List: 150-400ms

### After Caching (Cache Hit)
- Dashboard Load: **20-50ms** (10-16x faster)
- Individual Report: **15-40ms** (20-30x faster)
- Group Report: **25-60ms** (32-50x faster)
- Employee List: **10-25ms** (20-25x faster)
- Division List: **8-20ms** (18-25x faster)

### Overall System Improvement
- **Average speed increase: 20-30x faster**
- **Cache hit rate target: 80%+**
- **99th percentile response time: <100ms**

## 🛠️ Setup Instructions

### 1. Install Redis
```bash
# Windows (using Chocolatey)
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases

# Start Redis
redis-server
```

### 2. Configure Environment Variables
Add to `.env` file:
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_ENABLED=true
```

### 3. Verify Redis Connection
Check server logs on startup:
```
✅ Redis cache service connected successfully
```

### 4. Monitor Performance
Access performance dashboard at:
```
GET /api/performance/stats
```

## 🧪 Testing Performance

### Run Automated Tests
```bash
# Test dashboard performance
curl -X POST http://localhost:5000/api/performance/test/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test report performance
curl -X POST http://localhost:5000/api/performance/test/reports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"465963","startDate":"2026-01-22","endDate":"2026-01-22"}'
```

### Monitor Real-time Performance
```bash
# Get current statistics
curl http://localhost:5000/api/performance/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get endpoint-specific stats
curl http://localhost:5000/api/performance/endpoints \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get slow requests
curl http://localhost:5000/api/performance/slow-requests?limit=50 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎨 Visual Performance Indicators

### Console Logs
- `⚡ CACHE HIT` (Green) - Data retrieved from cache
- `📡` - Data fetched from database
- `⚠️ SLOW REQUEST` - Request took >1000ms

### Response Headers
Each response includes timing information in headers:
- `X-Response-Time`: Total response time
- `X-From-Cache`: true/false
- `X-Cache-Key`: Redis key used (if cached)

## 📝 Usage in Controllers

### Example: Dashboard Controller with Caching
```javascript
const redisCacheService = require('../services/redisCacheService');

const getDashboardStats = async (req, res) => {
  try {
    const cacheKey = redisCacheService.keys.dashboardStats();
    
    // Use cache-aside pattern
    const result = await redisCacheService.getOrSet(
      cacheKey,
      async () => {
        // Fetch from database
        const stats = await fetchStatsFromDatabase();
        return stats;
      },
      300 // TTL: 5 minutes
    );

    // Mark response as cached for monitoring
    res.fromCache = result.fromCache;
    res.cacheKey = cacheKey;

    res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        fromCache: result.fromCache,
        timing: `${result.timing}ms`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

## 🔍 Troubleshooting

### Redis Not Connected
**Symptom:** Console shows "Redis cache service initialization failed"
**Solution:**
1. Verify Redis is running: `redis-cli ping` (should return "PONG")
2. Check REDIS_HOST and REDIS_PORT in .env
3. Ensure no firewall blocking port 6379

### Low Cache Hit Rate (<50%)
**Symptom:** `GET /api/performance/stats` shows low hitRate
**Solution:**
1. Increase TTL values for stable data
2. Implement cache warming on sync operations
3. Check if cache is being invalidated too frequently

### Slow Requests Still Occurring
**Symptom:** Many entries in `/api/performance/slow-requests`
**Solution:**
1. Check if database queries need optimization
2. Add indexes to frequently queried fields
3. Implement pagination for large datasets
4. Pre-cache heavy reports during off-peak hours

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [Node Redis Client](https://github.com/redis/node-redis)
- [Caching Strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/Strategies.html)

## 🎯 Next Steps

1. **Run performance tests** to establish baseline
2. **Monitor cache hit rates** daily
3. **Adjust TTL values** based on usage patterns
4. **Implement cache warming** for predictable loads
5. **Set up Redis persistence** for production

---

**Last Updated:** January 22, 2026
**System Version:** 2.0 with Redis Caching
