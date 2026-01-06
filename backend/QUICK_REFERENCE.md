# Quick Reference - MySQL Sync System

## 🚀 Fast API Endpoints (Use These!)

### Divisions
```
GET /api/mysql-data/divisions
GET /api/mysql-data/divisions/:code
Query: ?search=port&includeEmployeeCount=true
```

### Sections
```
GET /api/mysql-data/sections
GET /api/mysql-data/sections/:code
Query: ?divisionCode=118&search=admin
```

### Employees
```
GET /api/mysql-data/employees
GET /api/mysql-data/employees/:empNo
Query: ?divisionCode=118&sectionCode=169&search=silva
```

### Dashboard
```
GET /api/dashboard/total-counts          (instant, <1ms)
POST /api/dashboard/total-counts/refresh (manual refresh)
```

## 🔄 Sync Management

```
POST /api/sync/trigger/full              (manual sync)
GET  /api/sync/status                     (sync history)
PUT  /api/sync/schedule                   (update schedule)
```

## ⏰ Schedule

- **When**: Every day at 12:00 PM (Asia/Colombo)
- **What**: Syncs divisions → sections → active employees
- **Duration**: ~90-100 seconds
- **Filter**: Only `ACTIVE_HRM_FLG = 1` employees

## 📊 Current Data

- **Divisions**: 30
- **Sections**: 284
- **Active Employees**: 7,223
- **Last Synced**: Check `/api/dashboard/total-counts`

## 🧪 Test Commands

```bash
# Test data service
node backend/test_mysql_data.js

# Test dashboard cache
node backend/test_dashboard_totals.js

# Run manual sync
node backend/run_initial_sync.js

# Check via API
curl http://localhost:5001/api/mysql-data/divisions
curl http://localhost:5001/api/dashboard/total-counts
curl http://localhost:5001/api/sync/status
```

## 💡 Performance

- Dashboard: **<1ms** (was 45-90 seconds)
- Divisions: **<5ms** (was 2-5 seconds)
- Sections: **<10ms** (was 3-8 seconds)
- Employees: **<50ms** (was 30-60 seconds)

## 🎯 Migration Path

**Replace all HRIS API calls with MySQL endpoints:**

```javascript
// OLD ❌
await fetch('/api/hris/employees')

// NEW ✅
await fetch('/api/mysql-data/employees')
```

## 📝 Key Files

- **Service**: `services/mysqlDataService.js`
- **Controllers**: `controllers/mysql*Controller.js`
- **Routes**: `routes/mysqlData.js`
- **Sync**: `services/hrisSyncService.js`
- **Scheduler**: `services/hrisSyncScheduler.js`

## ✅ Status Check

Server must be running on port **5001** (not 5000)

Ready to use! 🎉
