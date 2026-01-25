# Page-Wise Cache Activation System

## Overview
Implemented a **two-stage cache activation** system that runs sequentially during login:
1. **Stage 1:** Initial cache (Divisions, Sections, Sub-Sections, Employees, Attendance)
2. **Stage 2:** Page-wise cache (Dashboard, Division Mgmt, Section Mgmt, Employee Mgmt, Reports)

## User Experience Flow

```
User Logs In
    ↓
┌─────────────────────────────────────────────┐
│  STAGE 1: Initial Cache Activation          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ✓ Divisions                                │
│  ✓ Sections                                 │
│  ✓ Sub-Sections                             │
│  ✓ Employees                                │
│  ✓ Attendance (2026-01-10 to today)         │
└─────────────────────────────────────────────┘
    ↓ (Auto-triggers when Stage 1 completes)
┌─────────────────────────────────────────────┐
│  STAGE 2: Page-Wise Cache Activation        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  ▶ Dashboard Data          10 items         │
│  ⚫ Division Management     45 divisions     │
│  ⚫ Section Management      120 sections     │
│  ⚫ Employee Management     500 employees    │
│  ⚫ Report Templates        5 templates      │
└─────────────────────────────────────────────┘
    ↓
Navigate to Dashboard
```

## Stage 2: Page-Wise Cache Details

### 1. Dashboard Data (10 items)
**What's cached:**
- Total employees count
- Total divisions count
- Total sections count
- Today's attendance count
- Recent activities (placeholder)
- Chart data (placeholder)

**Cache keys:**
- `cache:dashboard:total_employees` (TTL: 1 hour)
- `cache:dashboard:total_divisions` (TTL: 1 hour)
- `cache:dashboard:total_sections` (TTL: 1 hour)
- `cache:dashboard:today_attendance` (TTL: 30 min)

### 2. Division Management Page
**What's cached:**
- All active divisions with metadata
- Employee count per division
- Division hierarchical relationships

**Cache keys:**
- `cache:divmgmt:{DIV_CODE}` - Individual division data
- `cache:divmgmt:list` - Complete division list

**Data structure:**
```javascript
{
  HIE_CODE: "DIV001",
  HIE_NAME: "Division Name",
  employeeCount: 125,
  cached_at: "2026-01-22T10:30:00.000Z"
}
```

### 3. Section Management Page
**What's cached:**
- All active sections with metadata
- Employee count per section
- Parent division information
- Section hierarchical relationships

**Cache keys:**
- `cache:secmgmt:{SEC_CODE}` - Individual section data
- `cache:secmgmt:list` - Complete section list

**Data structure:**
```javascript
{
  HIE_CODE: "SEC001",
  HIE_NAME: "Section Name",
  HIE_RELATIONSHIP: "DIV001",
  employeeCount: 45,
  parentDivisionName: "Division Name",
  cached_at: "2026-01-22T10:30:00.000Z"
}
```

### 4. Employee Management Page
**What's cached:**
- First 500 employees (pagination ready)
- Division and section names embedded
- Employee metadata

**Cache keys:**
- `cache:empmgmt:{EMP_NO}` - Individual employee data
- `cache:empmgmt:list` - Employee list summary (EMP_NO + EMP_NAME only)

**Data structure:**
```javascript
{
  EMP_NO: "E12345",
  EMP_NAME: "John Doe",
  DIV_CODE: "DIV001",
  SEC_CODE: "SEC001",
  divisionName: "Division Name",
  sectionName: "Section Name",
  cached_at: "2026-01-22T10:30:00.000Z"
}
```

### 5. Report Templates
**What's cached:**
- 5 common report templates
- Report metadata and types

**Cache keys:**
- `cache:report:template:{template_id}` (TTL: 2 hours)
- `cache:report:templates:all` (TTL: 2 hours)

**Templates:**
```javascript
[
  { id: 'daily', name: 'Daily Attendance Report', type: 'attendance' },
  { id: 'monthly', name: 'Monthly Attendance Summary', type: 'attendance' },
  { id: 'division', name: 'Division-wise Report', type: 'attendance' },
  { id: 'incomplete', name: 'Incomplete Punch Report', type: 'audit' },
  { id: 'late', name: 'Late Arrivals Report', type: 'audit' }
]
```

## Technical Implementation

### Backend: New Service Methods

#### `cachePreloadService.js`

**New Method:** `startPageWiseCacheJob(triggeredBy)`
- Creates a job with 5 steps
- Runs asynchronously in background
- Returns job descriptor with `type: 'page-wise'`
- Progress tracked per-page

**Page-Specific Cache Methods:**
1. `cacheDashboardData(onProgress)` - Caches 10 dashboard stats
2. `cacheDivisionManagementData(onProgress)` - Caches all divisions with employee counts
3. `cacheSectionManagementData(onProgress)` - Caches all sections with parent info
4. `cacheEmployeeManagementData(onProgress)` - Caches first 500 employees
5. `cacheReportTemplates(onProgress)` - Caches 5 report templates

**Progress Tracking:**
```javascript
job = {
  id: "preload_xyz",
  type: "page-wise",
  status: "running",
  percent: 65,
  currentStep: "Section Management",
  stepIndex: 2,
  steps: ["Dashboard Data", "Division Management", ...],
  stepTotals: [10, 45, 120, 500, 5],
  stepProgress: [10, 45, 78, 0, 0],
  cumulativeCompleted: 133,
  totalWork: 680,
  pageData: {
    dashboard: [...],
    divisionManagement: [...],
    sectionManagement: [...]
  }
}
```

### Backend: Controller & Routes

**New Controller:** `startPageWiseCacheActivation(req, res)`
- **Route:** `POST /api/cache/preload/pages`
- **Access:** Private (authenticated users)
- **Response:**
```javascript
{
  success: true,
  message: "Page-wise cache activation started",
  data: {
    jobId: "preload_abc123",
    status: "running",
    percent: 0,
    currentStep: "Dashboard Data",
    isNew: true,
    stepIndex: 0,
    steps: ["Dashboard Data", "Division Management", ...],
    type: "page-wise"
  }
}
```

**Polling Endpoint (reused):**
- `GET /api/cache/activation/:jobId` - Works for both stage 1 and stage 2 jobs

### Frontend: Login Flow Update

**Modified:** `Login.jsx` - Enhanced handleSubmit logic

**Flow:**
1. Stage 1 completes → Toast: "Initial cache complete - preparing pages..."
2. Automatically calls `/api/cache/preload/pages`
3. Starts polling the new page-wise job
4. Modal updates to show page-level progress
5. Stage 2 completes → Toast: "All cache ready - loading dashboard"
6. Navigates to dashboard

**UI Changes:**
- Same modal component (reused)
- Modal now shows **page names** instead of table names during Stage 2
- Progress bar updates based on page items cached
- User sees seamless transition between Stage 1 and Stage 2

## Progress Display Examples

### Stage 1 Modal (Initial Cache)
```
Cache Activation                         Job: 7a8b9c0d

Caching employees: 300/500

━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45% ━━━━━━━━

Caching Progress by Table:
✓ Divisions         10 / 10
✓ Sections          50 / 50
✓ Sub-Sections      20 / 20
▶ Employees        300 / 500
⚫ Attendance        0 / 149,420

Total Records: 380 / 150,000
```

### Stage 2 Modal (Page-Wise Cache)
```
Cache Activation                         Job: d4e5f6g7

Caching section management data...

━━━━━━━━━━━━━━━━━━━━━━━━━━━ 68% ━━━━━━━━

Caching Progress by Page:
✓ Dashboard Data           10 / 10
✓ Division Management      45 / 45
▶ Section Management       82 / 120
⚫ Employee Management       0 / 500
⚫ Report Templates          0 / 5

Total Items: 137 / 680
```

## Benefits

### 1. **Faster Page Load Times**
- Dashboard loads instantly (stats already cached)
- Division/Section management pages load from cache
- No database queries on initial page render

### 2. **Better User Experience**
- User sees exactly what's being cached
- Progress is meaningful (page names, not just %)
- Can skip if they want to start working immediately

### 3. **Reduced Database Load**
- Frequently accessed data pre-computed
- Employee counts calculated once
- Report templates ready to use

### 4. **Scalability**
- Only caches first 500 employees (configurable)
- Dashboard items are lightweight
- Report templates cached separately

### 5. **Transparency**
- User knows what data is available
- Progress shows which pages are ready
- Clear indication when all pages are cached

## Configuration

### Modify Items Cached

**Dashboard Items (10 items):**
Edit `cacheDashboardData()` in `cachePreloadService.js`
- Add more stats queries
- Add chart data preparation
- Add recent activities fetch

**Employee Limit (500):**
```javascript
// Line ~1585 in cachePreloadService.js
const [employees] = await sequelize.query(
  'SELECT * FROM employees_sync WHERE STATUS = "ACTIVE" LIMIT 500', // Change 500
  { raw: true }
);
```

**Report Templates (5):**
Edit `cacheReportTemplates()` to add more templates

### Cache TTL

```javascript
// Dashboard stats: 1 hour (3600 seconds)
await this.cache.set('cache:dashboard:total_employees', count, 3600);

// Today's attendance: 30 minutes (1800 seconds)
await this.cache.set('cache:dashboard:today_attendance', count, 1800);

// Report templates: 2 hours (7200 seconds)
await this.cache.set('cache:report:template:daily', template, 7200);
```

### Disable Page-Wise Cache

To skip Stage 2 entirely, comment out the page cache trigger in `Login.jsx`:

```javascript
// Comment these lines to disable Stage 2
// const pageRes = await fetch('/api/cache/preload/pages', { ... });
// Just navigate directly after Stage 1:
navigate('/dashboard');
```

## Testing Instructions

### Test Full Two-Stage Flow

1. **Clear cache:**
   ```bash
   redis-cli FLUSHDB
   ```

2. **Start backend and frontend:**
   ```bash
   cd backend && node server.js
   cd frontend && npm start
   ```

3. **Login:**
   - Should see Stage 1 modal (Divisions, Sections, etc.)
   - Watch progress to 100%
   - Toast: "Initial cache complete - preparing pages..."
   - Modal continues with Stage 2 (Dashboard, Division Mgmt, etc.)
   - Watch progress to 100%
   - Toast: "All cache ready - loading dashboard"
   - Navigates to dashboard

4. **Verify cached data:**
   ```bash
   redis-cli KEYS "cache:*"
   redis-cli GET cache:dashboard:total_employees
   redis-cli GET cache:divmgmt:list
   ```

### Test Multi-Session Behavior

1. **Window 1:** Login, watch Stage 1 complete, watch Stage 2 start
2. **Window 2:** Login during Stage 2 of Window 1
   - Should join the same Stage 2 job
   - Both windows show synchronized progress

### Test Skip Functionality

- Click "Skip & Continue" during any stage
- Should navigate to dashboard immediately
- Cache continues in background

## API Endpoints

### Start Page-Wise Cache
```http
POST /api/cache/preload/pages
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Page-wise cache activation started",
  "data": {
    "jobId": "preload_abc123",
    "status": "running",
    "percent": 0,
    "currentStep": "Dashboard Data",
    "isNew": true,
    "type": "page-wise"
  }
}
```

### Get Progress (Both Stages)
```http
GET /api/cache/activation/:jobId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "job": {
    "id": "preload_abc123",
    "type": "page-wise",
    "status": "running",
    "percent": 45,
    "currentStep": "Section Management",
    "stepIndex": 2,
    "steps": ["Dashboard Data", "Division Management", ...],
    "stepTotals": [10, 45, 120, 500, 5],
    "stepProgress": [10, 45, 54, 0, 0],
    "totalWork": 680,
    "cumulativeCompleted": 109,
    "pageData": { ... }
  }
}
```

## Files Modified

1. **[backend/services/cachePreloadService.js](backend/services/cachePreloadService.js)**
   - Added `startPageWiseCacheJob()` method
   - Added 5 page-specific cache methods
   - Enhanced job tracking with `type` field

2. **[backend/controllers/cacheController.js](backend/controllers/cacheController.js)**
   - Added `startPageWiseCacheActivation()` controller
   - Exported new function

3. **[backend/routes/cache.js](backend/routes/cache.js)**
   - Added `POST /api/cache/preload/pages` route
   - Imported `startPageWiseCacheActivation` function

4. **[frontend/src/components/auth/Login.jsx](frontend/src/components/auth/Login.jsx)**
   - Enhanced Stage 1 completion handler
   - Added automatic Stage 2 trigger
   - Added nested polling for Stage 2 progress
   - Toast messages for stage transitions

## Performance Metrics

### Expected Timings (depends on data size)

- **Stage 1 (Initial Cache):** 30-90 seconds
  - Divisions: <1s
  - Sections: 1-2s
  - Sub-Sections: 1-2s
  - Employees: 2-5s
  - Attendance: 20-80s (most time-consuming)

- **Stage 2 (Page-Wise):** 5-15 seconds
  - Dashboard: <1s
  - Division Mgmt: 1-2s
  - Section Mgmt: 2-3s
  - Employee Mgmt: 2-5s
  - Report Templates: <1s

### Database Queries Saved (per page load)

- **Dashboard:** 4 queries → 0 queries (100% cached)
- **Division Mgmt:** N+1 queries → 1 query (list from cache)
- **Section Mgmt:** N+2 queries → 1 query (list from cache)
- **Employee Mgmt:** N queries → 0 queries (cached)

## Troubleshooting

### Stage 2 Doesn't Start
- Check backend logs for errors in `startPageWiseCacheJob()`
- Verify route is registered: `POST /api/cache/preload/pages`
- Check frontend console for API call errors

### Modal Stuck on Stage 1
- Check if Stage 1 job is actually completing (backend logs)
- Verify frontend detects `status: 'completed'`
- Check for JavaScript errors in browser console

### Cached Data Not Loading
- Check Redis keys: `redis-cli KEYS "cache:*"`
- Verify TTL hasn't expired
- Check page code is using correct cache keys

---

**Implementation Date:** January 22, 2026  
**Status:** ✅ Complete and Ready for Testing  
**Total Cache Stages:** 2 (Initial + Page-Wise)
