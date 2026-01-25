# Multi-Session Cache Activation Fix

## Problem
When one user session activated the cache, other sessions logging in simultaneously wouldn't see the cache activation UI. They would just navigate directly to the dashboard while the cache was still loading in the background.

## Root Cause
1. When Session A started cache activation, it created a job and started caching
2. When Session B logged in during this time:
   - `startFullSystemPreloadJob()` detected an active job and returned it
   - BUT the frontend in Session B only checked `is_warm` status via `/api/cache/status`
   - Since cache wasn't warm yet, it would try to start a new job
   - The backend returned the existing job, but the frontend didn't recognize it should show the UI

## Solution

### Backend Changes

#### 1. Modified `startFullSystemPreloadJob()` in `cachePreloadService.js`
**Before:**
```javascript
if (this.activeJobId) {
  const active = this.jobs.get(this.activeJobId);
  if (active && active.status === 'running') return active; // Just returned job
}
```

**After:**
```javascript
if (this.activeJobId) {
  const active = this.jobs.get(this.activeJobId);
  if (active && active.status === 'running') {
    console.log(`♻️  Reusing existing cache activation job ${this.activeJobId} for ${triggeredBy}`);
    return { job: active, isNew: false }; // Return job + flag indicating it's reused
  }
}
// ...
return { job, isNew: true }; // Return job + flag indicating it's new
```

#### 2. Updated `startLoginCacheActivation()` in `cacheController.js`
**Added:**
- Handles return value that can be `{ job, isNew }` or just job
- Returns `isNew` flag in response so frontend knows if job was newly created or reused
- Message changes based on whether job is new: "Cache activation started" vs "Cache activation already in progress"

```javascript
const result = cachePreloadService.startFullSystemPreloadJob(String(triggeredBy));
const job = result.job || result;
const isNew = result.isNew !== undefined ? result.isNew : true;

return res.status(202).json({
  success: true,
  message: isNew ? 'Cache activation started' : 'Cache activation already in progress',
  data: {
    jobId: job.id,
    status: job.status,
    percent: job.percent,
    currentStep: job.currentStep,
    isNew: isNew, // <-- New field
    // ...
  }
});
```

### Frontend Changes

#### 3. Simplified Login Flow in `AuthContext.js`
**Before:**
- Checked `/api/cache/status` first
- If not warm, then called `/api/cache/preload/login`
- Complex conditional logic

**After:**
- **Always** calls `/api/cache/preload/login` on every login
- Backend handles whether to create new job or return existing one
- If response contains `jobId`, show cache activation UI (regardless of `isNew` flag)
- If no `jobId`, cache is already warm

```javascript
// Always trigger login preload endpoint - it will either start new job or return existing one
const preloadRes = await fetch('http://localhost:5000/api/cache/preload/login', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
});

if (preloadRes.ok) {
  const preloadData = await preloadRes.json().catch(() => ({}));
  if (preloadData && preloadData.success && preloadData.data) {
    // If there's a jobId, cache activation is needed (either new or in progress)
    if (preloadData.data.jobId) {
      const cacheInfo = { 
        is_warm: false, 
        job: preloadData.data,
        isNew: preloadData.data.isNew !== false // true if new or undefined
      };
      const status = preloadData.data.isNew ? 'started' : 'joined existing activation';
      console.log(`🚀 Cache activation ${status}:`, cacheInfo);
      setCacheStatus(cacheInfo);
      data.cache = cacheInfo;
    } else {
      // No jobId means cache is already warm
      const cacheInfo = { is_warm: true };
      console.log('✅ Cache is already warm');
      setCacheStatus(cacheInfo);
      data.cache = cacheInfo;
    }
  }
}
```

## How It Works Now

### Scenario 1: First User Logs In (Cache Cold)
```
User A Login
    ↓
AuthContext calls /api/cache/preload/login
    ↓
Backend creates NEW job (job_123)
    ↓
Backend returns { jobId: "job_123", isNew: true, ... }
    ↓
Frontend shows cache activation modal
    ↓
Modal polls progress every 2s
    ↓
Cache completes → Navigate to dashboard
```

### Scenario 2: Second User Logs In (During Active Caching)
```
User B Login (while User A's cache job is running)
    ↓
AuthContext calls /api/cache/preload/login
    ↓
Backend detects existing job (job_123)
    ↓
Backend returns SAME job { jobId: "job_123", isNew: false, percent: 45, ... }
    ↓
Frontend sees jobId → shows cache activation modal
    ↓
Modal shows current progress (45%)
    ↓
Both User A and User B see the same progress
    ↓
Cache completes → Both navigate to dashboard
```

### Scenario 3: Third User Logs In (Cache Already Warm)
```
User C Login (after cache is warm)
    ↓
AuthContext calls /api/cache/preload/login
    ↓
Backend sees no active job AND cache is warm
    ↓
Backend returns { jobId: null } or empty response
    ↓
Frontend sees no jobId → sets is_warm: true
    ↓
No modal shown → Direct navigation to dashboard
```

## Benefits

1. **All sessions see cache progress** - No matter when they log in during caching
2. **No duplicate cache jobs** - Backend prevents multiple simultaneous cache operations
3. **Shared progress** - All users see the same job progress
4. **Simplified logic** - Frontend doesn't need to check status separately
5. **Better UX** - Users understand why login takes longer (they see progress)

## Console Messages

### Session A (starts cache):
```
🚀 Cache activation started: { is_warm: false, job: { jobId: "preload_...", isNew: true }, isNew: true }
```

### Session B (joins existing):
```
🚀 Cache activation joined existing activation: { is_warm: false, job: { jobId: "preload_...", isNew: false, percent: 45 }, isNew: false }
```

### Session C (cache warm):
```
✅ Cache is already warm
```

## Testing Instructions

1. **Clear cache** to start fresh:
   ```bash
   redis-cli FLUSHDB
   ```

2. **Open two browser windows** (or incognito + regular)

3. **Window 1:** Login with User A
   - Should see cache activation modal appear immediately
   - Watch progress: 0% → 100%

4. **Window 2:** While Window 1 is caching (e.g., at 50%), login with User B
   - Should see cache activation modal appear
   - Should show current progress (e.g., 50%)
   - Should continue from where Window 1 is
   - Both windows show synchronized progress

5. **Wait for completion** in both windows
   - Both should navigate to dashboard at roughly the same time

6. **Window 3:** Login with User C after cache is complete
   - Should NOT see cache activation modal
   - Should go directly to dashboard

## Edge Cases Handled

✅ **Multiple simultaneous logins** - All see the same job  
✅ **Job completes while logging in** - User sees completed job and navigates  
✅ **One user skips** - Other users still see progress  
✅ **Job fails** - All users see failure and can skip  
✅ **Network issues** - Each session polls independently  

## Files Modified

1. [backend/services/cachePreloadService.js](backend/services/cachePreloadService.js) - Return `{ job, isNew }` instead of just `job`
2. [backend/controllers/cacheController.js](backend/controllers/cacheController.js) - Handle `isNew` flag and return it in response
3. [frontend/src/context/AuthContext.js](frontend/src/context/AuthContext.js) - Simplified to always call preload endpoint, show UI if jobId present

## Rollback

If issues occur:
```bash
git diff HEAD~1 backend/services/cachePreloadService.js
git diff HEAD~1 backend/controllers/cacheController.js
git diff HEAD~1 frontend/src/context/AuthContext.js
git revert HEAD  # If needed
```

---

**Status:** ✅ Fixed and Ready for Testing  
**Date:** January 22, 2026
