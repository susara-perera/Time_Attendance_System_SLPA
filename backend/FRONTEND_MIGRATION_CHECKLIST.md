# Frontend Migration Checklist

## 🎯 Goal
Replace all HRIS API calls with fast MySQL endpoints for instant data loading.

## 📋 Changes Needed

### 1. Division Management Components

**Files to Update:**
- `frontend/src/components/division/DivisionList.jsx`
- `frontend/src/components/division/DivisionForm.jsx`
- Any component fetching divisions

**Change:**
```javascript
// OLD ❌ (2-5 seconds)
const response = await fetch('/api/divisions?source=hris');

// NEW ✅ (<5ms)
const response = await fetch('/api/mysql-data/divisions?includeEmployeeCount=true');
```

### 2. Section Management Components

**Files to Update:**
- `frontend/src/components/section/SectionList.jsx`
- `frontend/src/components/section/SectionForm.jsx`
- Any component fetching sections

**Change:**
```javascript
// OLD ❌ (3-8 seconds)
const response = await fetch('/api/sections');

// NEW ✅ (<10ms)
const response = await fetch('/api/mysql-data/sections?divisionCode=118');
```

### 3. Employee Components

**Files to Update:**
- `frontend/src/components/employee/*`
- Any component fetching employees

**Change:**
```javascript
// OLD ❌ (30-60 seconds)
const response = await fetch('/api/employees');

// NEW ✅ (<50ms)
const response = await fetch('/api/mysql-data/employees?divisionCode=118&search=silva');
```

### 4. Dashboard Component ⚡ CRITICAL

**File:** `frontend/src/components/dashboard/DashboardStats.jsx`

**Already Configured!** ✅
The component already uses `/api/dashboard/total-counts` for instant loading with:
- sessionStorage caching
- 250ms loading delay before spinner
- Auto-refresh support

**No changes needed** - it's already optimized!

### 5. Dropdowns/Selects

**Files to Update:**
- Any component with division/section dropdowns
- Filter components
- Report filters

**Change:**
```javascript
// OLD ❌
const divisions = await fetch('/api/divisions').then(r => r.json());

// NEW ✅
const divisions = await fetch('/api/mysql-data/divisions').then(r => r.json());
```

### 6. Search/Filter Components

**Enhancement:** Add real-time search
```javascript
// Search is now instant!
const searchEmployees = debounce(async (term) => {
  const response = await fetch(`/api/mysql-data/employees?search=${term}`);
  const data = await response.json();
  setResults(data.data); // <50ms response!
}, 300);
```

### 7. Report Components

**Files to Update:**
- `frontend/src/components/reports/*`

**Change:**
```javascript
// For employee lists in reports
const employees = await fetch(
  `/api/mysql-data/employees?divisionCode=${divCode}&sectionCode=${secCode}`
);
```

## 🔄 API Response Format Changes

### MySQL Endpoints Return:
```javascript
{
  success: true,
  count: 30,
  data: [
    {
      HIE_CODE: "118",
      HIE_NAME: "Port of Galle",
      code: "118",
      name: "Port of Galle",
      employeeCount: 245,
      source: "MySQL"
    }
  ],
  source: "MySQL Sync"
}
```

### Field Mapping:
```javascript
// Divisions
item.HIE_CODE → Division code
item.HIE_NAME → Division name
item.code → Alias for HIE_CODE
item.name → Alias for HIE_NAME

// Sections
item.HIE_CODE → Section code
item.HIE_NAME → Section name
item.HIE_RELATIONSHIP → Parent division code
item.division_code → Alias for HIE_RELATIONSHIP

// Employees
item.EMP_NO → Employee number
item.EMP_NAME → Full name
item.DIV_CODE → Division code
item.SEC_CODE → Section code
item.employeeId → Alias for EMP_NO
```

## ✅ Testing Checklist

After each change:

1. [ ] Component loads instantly (no 30-60 second wait)
2. [ ] Data displays correctly
3. [ ] Search/filter works
4. [ ] Dropdowns populate
5. [ ] No console errors
6. [ ] Source shows "MySQL Sync" in response

## 🎯 Priority Order

### High Priority (Do First):
1. ✅ Dashboard - Already done!
2. Employee lists/search
3. Division dropdowns
4. Section dropdowns

### Medium Priority:
5. Report filters
6. Employee detail views
7. Division management
8. Section management

### Low Priority:
9. Historical views
10. Analytics dashboards

## 📝 Notes

- **Backward Compatible**: Old endpoints still work
- **Gradual Migration**: Update one component at a time
- **Test Locally**: Use curl to test endpoints first
- **Cache Benefits**: MySQL data is consistent (synced daily)
- **Error Handling**: Same error handling, just faster!

## 🚀 Expected Results

After migration:
- Dashboard loads in <1 second (was 45-90 seconds)
- Employee lists load in <50ms (was 30-60 seconds)
- Division/section dropdowns instant (was 2-8 seconds)
- Search is real-time (was impossible)
- Offline capable (doesn't need HRIS API)

## 🆘 If Something Breaks

1. Check endpoint: `curl http://localhost:5001/api/mysql-data/divisions`
2. Verify data exists: `node backend/test_mysql_data.js`
3. Check sync status: `curl http://localhost:5001/api/sync/status`
4. Run manual sync: `curl -X POST http://localhost:5001/api/sync/trigger/full`

## 📞 Support

- See `QUICK_REFERENCE.md` for API details
- See `MYSQL_SYNC_COMPLETE_GUIDE.md` for full docs
- Test scripts in `backend/test_*.js`

Ready to migrate! 🎉
