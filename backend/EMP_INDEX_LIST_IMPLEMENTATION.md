# Employee Index List (emp_index_list) - Implementation Summary

## Overview
Created a new hierarchical employee index table (`emp_index_list`) that combines data from divisions, sections, sub-sections, and employees for fast filtering and reporting.

## Table Structure
- **division_id** (VARCHAR, NOT NULL) - Division primary key
- **division_name** (VARCHAR) - Division name
- **section_id** (VARCHAR) - Section primary key
- **section_name** (VARCHAR) - Section name
- **sub_section_id** (VARCHAR) - Sub-section primary key
- **employee_id** (VARCHAR, NOT NULL) - Employee ID
- **employee_name** (VARCHAR) - Employee name
- **synced_at** (TIMESTAMP) - Last sync timestamp

### Indexes
- Primary key: `id` (auto-increment)
- Unique key: `unique_emp_index` on (division_id, section_id, sub_section_id, employee_id)
- Indexes on: division_id, section_id, sub_section_id, employee_id

## Sync Logic
The sync service (`empIndexSyncService.js`) performs the following:

1. **Fetches data from base tables:**
   - `divisions_sync` - All divisions from HRIS
   - `sections_sync` - All sections from HRIS
   - `sub_sections` - All sub-sections from HRIS
   - `employees_sync` - **Only active employees** (WHERE IS_ACTIVE = 1)

2. **Builds hierarchical relationships:**
   - Maps employees to their divisions and sections
   - Uses division/section IDs to look up names
   - Skips employees without division_id (1 employee skipped in current dataset)

3. **Upsert logic:**
   - Uses `INSERT ... ON DUPLICATE KEY UPDATE` for idempotency
   - Updates division_name, section_name, employee_name on subsequent syncs
   - Updates synced_at timestamp on every sync

## Current Data Statistics
As of last sync (January 7, 2026 11:31 AM):
- **Total records:** 7,470 active employees
- **Employees skipped:** 1 (no division assigned)
- **Employees without section:** 95

### Top 5 Divisions by Employee Count:
1. Operations (Container Operations) - 1,082 employees
2. Security - 775 employees
3. Navigation - 640 employees
4. Engineering (Civil) - 533 employees
5. Logistics - 462 employees

## Automated Sync Schedule
- **Frequency:** Daily at 12:00 PM (Sri Lanka time)
- **Trigger:** Automated via `hrisSyncScheduler`
- **Integration:** Runs as part of `performFullSync()` after:
  1. Divisions sync
  2. Sections sync
  3. Employees sync
  4. Attendance sync
  5. **emp_index_list sync** ← New addition

## Files Created/Modified

### Created:
1. `backend/config/createEmpIndexTable.sql` - Table schema
2. `backend/services/empIndexSyncService.js` - Sync service
3. `backend/scripts/create_emp_index_table.js` - Table creation script
4. `backend/scripts/run_emp_index_sync.js` - Manual sync trigger
5. `backend/scripts/verify_emp_index.js` - Data verification script

### Modified:
1. `backend/services/hrisSyncService.js` - Added emp_index sync to performFullSync
2. `backend/server.js` - Enabled scheduler (uncommented initialization)

## Manual Operations

### Create Table:
```bash
node scripts/create_emp_index_table.js
```

### Run Manual Sync:
```bash
node scripts/run_emp_index_sync.js
```

### Verify Data:
```bash
node scripts/verify_emp_index.js
```

## Usage Example
The `emp_index_list` table can now be used for fast hierarchical filtering:

```sql
-- Get all employees in a specific division
SELECT * FROM emp_index_list WHERE division_id = '8';

-- Get all employees in a specific section
SELECT * FROM emp_index_list WHERE section_id = '33';

-- Get employees by division and section
SELECT * FROM emp_index_list 
WHERE division_id = '8' AND section_id = '33';

-- Count employees by division
SELECT division_name, COUNT(*) as employee_count 
FROM emp_index_list 
GROUP BY division_id, division_name 
ORDER BY employee_count DESC;
```

## Benefits
1. **Fast Filtering:** Single table join instead of multiple table joins
2. **Active Employees Only:** Syncs only IS_ACTIVE = 1 employees
3. **Daily Updates:** Automatically stays in sync with HRIS data
4. **Hierarchical Indexing:** Optimized for division/section/subsection filtering
5. **Idempotent:** Can be run multiple times safely

## Next Steps (Future Enhancements)
1. Populate `sub_section_id` from `transferred_employees` table for employees assigned to sub-sections
2. Add API endpoints to query emp_index_list directly
3. Use emp_index_list in report generation for improved performance
4. Add more indexes if specific query patterns emerge

## Technical Notes
- Sync duration: ~29 seconds for 7,215 employees
- Uses prepared statements for security
- Handles NULL values gracefully
- Logs detailed metrics (inserted/updated/skipped counts)
- Error handling with try-catch and proper logging
