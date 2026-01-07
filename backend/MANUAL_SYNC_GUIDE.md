# Manual Sync System

## Overview

The Manual Sync System allows administrators to manually trigger synchronization of data from the HRIS API to the local MySQL database. This provides better control over when data is synced and allows viewing of newly added records.

## Key Features

### ✅ Optimized Sync Behavior
- **Only New Records**: Syncs now only add new records, skipping existing ones (no unnecessary updates)
- **New Records Tracking**: Each sync returns a list of newly added records
- **Performance**: Faster sync operations by avoiding redundant updates

### 📊 Available Sync Operations

1. **Divisions Sync**
   - Syncs company divisions (DEF_LEVEL = 3) from HRIS
   - Table: `divisions_sync`
   - Fields: HIE_CODE, HIE_NAME, status, etc.

2. **Sections Sync**
   - Syncs organizational sections (DEF_LEVEL = 4) from HRIS
   - Table: `sections_sync`
   - Fields: HIE_CODE, HIE_NAME, HIE_RELATIONSHIP, etc.

3. **Employees Sync**
   - Syncs active employee records from HRIS
   - Table: `employees_sync`
   - Fields: EMP_NO, EMP_NAME, designation, division, section, etc.

4. **Employee Index Sync**
   - Builds hierarchical index for fast employee filtering
   - Table: `emp_index_list`
   - Combines: divisions, sections, sub-sections, employees

5. **Sub-Sections**
   - Checks status of manually managed sub-sections
   - Table: `sub_sections`
   - Note: Sub-sections are created through Division Management UI

6. **Attendance Sync**
   - Syncs attendance records (default: last 7 days)
   - Tables: `attendance_sync`, `attendance_punches_sync`
   - Aggregates punch data from biometric devices

## Usage

### Frontend (Manual Sync UI)

1. **Access**: Login as Super Admin or Admin
2. **Navigate**: Click "Manual Sync" in the sidebar
3. **Select**: Click sync button for desired table
4. **View Results**: Popup shows newly added records

### Backend API Endpoints

All endpoints require authentication (admin or super_admin role).

#### Trigger Individual Syncs

```http
POST /api/sync/trigger/divisions
Authorization: Bearer <token>
```

```http
POST /api/sync/trigger/sections
Authorization: Bearer <token>
```

```http
POST /api/sync/trigger/employees
Authorization: Bearer <token>
```

```http
POST /api/sync/trigger/emp-index
Authorization: Bearer <token>
```

```http
POST /api/sync/trigger/subsections
Authorization: Bearer <token>
```

```http
POST /api/sync/trigger/attendance
Authorization: Bearer <token>
Content-Type: application/json

{
  "startDate": "2026-01-01",  // Optional
  "endDate": "2026-01-07"     // Optional
}
```

#### Response Format

```json
{
  "success": true,
  "message": "Divisions sync completed",
  "data": {
    "recordsSynced": 30,
    "recordsAdded": 5,
    "recordsUpdated": 25,
    "recordsFailed": 0,
    "duration": 3,
    "newRecords": [
      {
        "HIE_CODE": "500",
        "HIE_NAME": "New Division",
        "STATUS": "ACTIVE",
        "synced_at": "2026-01-07 10:30:00"
      }
      // ... more newly added records
    ]
  }
}
```

## Technical Implementation

### Modified Services

#### 1. hrisSyncService.js
- **syncDivisions()**: Checks if division exists, only inserts if new
- **syncSections()**: Checks if section exists, only inserts if new  
- **syncEmployees()**: Checks if employee exists, only inserts if new
- All return `newRecords` array with details of added records

#### 2. empIndexSyncService.js
- **syncEmpIndex()**: Only inserts new employee index entries
- Skips existing employee_id records
- Returns newly indexed employees

#### 3. subSectionSyncService.js
- **syncSubSections()**: Returns status of manually managed sub-sections
- No external sync (managed through UI)

### Sync Logic Flow

```javascript
// Before (Old Behavior)
if (exists) {
  await update(record);  // Updates existing records
  recordsUpdated++;
} else {
  await create(record);
  recordsAdded++;
}

// After (New Behavior)
if (exists) {
  recordsUpdated++;  // Just count, don't update
} else {
  const newRecord = await create(record);
  recordsAdded++;
  newRecords.push(newRecord);  // Track new records
}
```

### Database Tables

```sql
-- divisions_sync
CREATE TABLE divisions_sync (
  id INT PRIMARY KEY AUTO_INCREMENT,
  HIE_CODE VARCHAR(50) UNIQUE NOT NULL,
  HIE_NAME VARCHAR(255),
  STATUS VARCHAR(20),
  synced_at DATETIME
);

-- sections_sync
CREATE TABLE sections_sync (
  id INT PRIMARY KEY AUTO_INCREMENT,
  HIE_CODE VARCHAR(50) UNIQUE NOT NULL,
  HIE_NAME_4 VARCHAR(255),
  HIE_RELATIONSHIP VARCHAR(50),
  STATUS VARCHAR(20),
  synced_at DATETIME
);

-- employees_sync
CREATE TABLE employees_sync (
  id INT PRIMARY KEY AUTO_INCREMENT,
  EMP_NO VARCHAR(50) UNIQUE NOT NULL,
  EMP_NAME VARCHAR(255),
  EMP_DESIGNATION VARCHAR(100),
  DIV_CODE VARCHAR(50),
  SEC_CODE VARCHAR(50),
  IS_ACTIVE BOOLEAN,
  synced_at DATETIME
);

-- emp_index_list
CREATE TABLE emp_index_list (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(255),
  division_id VARCHAR(50),
  division_name VARCHAR(255),
  section_id VARCHAR(50),
  section_name VARCHAR(255),
  sub_section_id INT,
  synced_at DATETIME
);
```

## Testing

### Run Test Suite

```bash
cd backend
node test_manual_sync.js
```

**Note**: Update `ADMIN_TOKEN` in the test script before running.

### Manual Testing

1. **First Sync**: Should add all records as new
2. **Second Sync**: Should skip all existing records (0 new)
3. **Add New Data in HRIS**: Third sync should only add the new records
4. **Check Modal**: Newly added records display in popup

## Permissions

Only users with the following roles can trigger manual sync:
- `super_admin` (all sync operations)
- `admin` (all sync operations except full sync)

## Scheduled Sync

Automatic sync still runs daily at 12 PM (configurable).

To update schedule:
```http
PUT /api/sync/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "cronExpression": "0 12 * * *"
}
```

## Troubleshooting

### "Failed to sync" Error
- Check HRIS API connectivity
- Verify admin token is valid
- Check backend logs for details

### "No new records" Result
- All records already exist in database
- This is normal for subsequent syncs
- Only new HRIS data will be added

### Slow Sync Performance
- Large employee datasets may take time
- Consider syncing during off-peak hours
- Check database connection pool settings

## Future Enhancements

- [ ] Selective record update option
- [ ] Sync history/audit trail
- [ ] Progress indicators for long-running syncs
- [ ] Batch sync with multiple date ranges
- [ ] Export sync results to CSV
- [ ] Sync scheduling per table

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Review sync_logs table: `SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10`
3. Contact system administrator
