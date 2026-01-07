# Employee Index Sync System - Quick Reference

## What Was Created
A complete sync system that builds and maintains the `emp_index_list` table daily at 12 PM.

## Table: emp_index_list
Stores hierarchical employee data combining:
- ✅ **Divisions** (from HRIS API → divisions_sync)
- ✅ **Sections** (from HRIS API → sections_sync)  
- ✅ **Sub-sections** (from HRIS API → sub_sections)
- ✅ **Active Employees Only** (from HRIS API → employees_sync WHERE IS_ACTIVE = 1)

## Fields Synced
| Field | Source | Description |
|-------|--------|-------------|
| division_id | employees_sync.DIV_CODE | Primary key (required) |
| division_name | divisions_sync.HIE_NAME | Division name |
| section_id | employees_sync.SEC_CODE | Section primary key |
| section_name | sections_sync.HIE_NAME | Section name |
| sub_section_id | - | For future use (transferred employees) |
| employee_id | employees_sync.EMP_NO | Employee ID (required) |
| employee_name | employees_sync.EMP_NAME | Employee name |
| synced_at | NOW() | Last sync timestamp |

## Current Status ✅
- **Table Created:** Yes
- **Initial Sync Complete:** Yes
- **Records Synced:** 7,470 active employees
- **Scheduler Enabled:** Yes (daily at 12:00 PM)
- **Last Sync:** January 7, 2026 11:31 AM

## Automated Schedule
- **When:** Every day at 12:00 PM (Sri Lanka time)
- **What Syncs:**
  1. Divisions from HRIS → divisions_sync
  2. Sections from HRIS → sections_sync
  3. Sub-sections from HRIS → sub_sections
  4. Employees from HRIS → employees_sync
  5. Attendance data (last 30 days) → attendance_sync
  6. **Employee index → emp_index_list** ← NEW

## Manual Commands

### Run Sync Manually:
```bash
cd backend
node scripts/run_emp_index_sync.js
```

### Verify Data:
```bash
cd backend
node scripts/verify_emp_index.js
```

### Recreate Table:
```bash
cd backend
node scripts/create_emp_index_table.js
```

## How It Works

1. **Scheduler triggers at 12 PM** (`hrisSyncScheduler.js`)
2. **Full sync runs** (`hrisSyncService.js → performFullSync()`)
3. **Base tables synced first:** divisions_sync, sections_sync, employees_sync
4. **emp_index sync runs last** (`empIndexSyncService.js → syncEmpIndex()`)
5. **Data combined and inserted/updated** into emp_index_list

## Key Features

✅ **Active Employees Only** - Filters WHERE IS_ACTIVE = 1  
✅ **Idempotent** - Safe to run multiple times  
✅ **Fast Lookups** - Indexed on division_id, section_id, employee_id  
✅ **Daily Updates** - Stays in sync with HRIS automatically  
✅ **Error Handling** - Logs errors, continues on failure  
✅ **Skips Invalid Data** - Employees without division are skipped

## Performance
- Sync Time: ~29 seconds
- Records Processed: 7,470 employees
- Efficiency: ~250 records/second

## Files Reference
- **Table Schema:** `backend/config/createEmpIndexTable.sql`
- **Sync Service:** `backend/services/empIndexSyncService.js`
- **Scheduler:** `backend/services/hrisSyncScheduler.js`
- **Main Service:** `backend/services/hrisSyncService.js`
- **Server Config:** `backend/server.js` (line 87-89)

## Troubleshooting

### Sync Failed?
```bash
# Check logs for errors
node scripts/run_emp_index_sync.js
```

### Missing Records?
```bash
# Verify data
node scripts/verify_emp_index.js
```

### Table Missing?
```bash
# Recreate table
node scripts/create_emp_index_table.js
```

## Next Steps (Optional)
- Add API endpoints to query emp_index_list
- Populate sub_section_id for transferred employees
- Use in report generation for better performance
