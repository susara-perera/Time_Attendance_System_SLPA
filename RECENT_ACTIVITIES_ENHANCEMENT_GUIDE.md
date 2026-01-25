# Recent Activities Enhancement - Implementation Guide

## Overview
The Recent Activities system has been enhanced to:
1. Track ALL types of user activities comprehensively
2. Maintain a strict 50-record FIFO limit (oldest auto-deleted when 51st is added)
3. Use centralized `logRecentActivity()` service for consistency

## Usage Pattern

### New Centralized Method (Recommended)
```javascript
const { logRecentActivity } = require('../services/activityLogService');

await logRecentActivity({
  title: 'Activity Title',
  description: 'Detailed description',
  activity_type: 'type_name',
  entity_id: 'optional_entity_id',
  entity_name: 'optional_entity_name',
  user_id: user._id?.toString(),
  user_name: user.fullName
  // icon is auto-assigned based on activity_type
});
```

### Old Method (Being Replaced)
```javascript
// DON'T USE - No automatic FIFO cleanup
await RecentActivity.create({...});
```

## Activity Types Tracked

### User Management
- `user_created` - New user account created
- `user_updated` - User account modified
- `user_deleted` - User account removed
- `user_login` - User logged in ✅ (already implemented)
- `user_logout` - User logged out

### Division Management
- `division_created` - New division created
- `division_updated` - Division modified
- `division_deleted` - Division removed

### Section Management
- `section_created` - New section created ✅ (already implemented)
- `section_updated` - Section modified ✅ (already implemented)
- `section_deleted` - Section removed ✅ (already implemented)

### Sub-Section Management
- `subsection_created` - New sub-section created ✅ (already implemented)
- `subsection_updated` - Sub-section modified
- `subsection_deleted` - Sub-section removed ✅ (already implemented)

### Employee Management
- `employee_created` - New employee added
- `employee_updated` - Employee details modified
- `employee_deleted` - Employee removed
- `employee_transferred` - Employee transferred to different sub-section ✅ (already implemented)
- `employee_recalled` - Employee transfer recalled

### Permission & Role Management
- `permissions_updated` - User permissions changed ✅ (already implemented)
- `role_created` - New role created ✅ (already implemented)
- `role_updated` - Role modified
- `role_deleted` - Role removed

### Meal Management
- `meal_created` - New meal created ✅ (already implemented)
- `meal_updated` - Meal modified ✅ (already implemented)
- `meal_deleted` - Meal removed ✅ (already implemented)
- `meal_booked` - Meal booked by user

### Attendance Activities
- `check_in` - Employee checked in ✅ (already implemented)
- `check_out` - Employee checked out ✅ (already implemented)
- `break_start` - Break started
- `break_end` - Break ended

### System Activities
- `sync_triggered` - Manual sync initiated
- `sync_completed` - Sync completed successfully
- `cache_cleared` - Cache manually cleared
- `cache_refreshed` - Cache refreshed
- `backup_created` - System backup created

### Report Activities
- `report_generated` - Report generated
- `report_exported` - Report exported (PDF/Excel)
- `report_viewed` - Report viewed

## Implementation Status

### ✅ Already Using logRecentActivity
- authController.js - user_login

### 🔄 Need to Update (Use logRecentActivity)
All files currently using `RecentActivity.create()` directly:
- divisionController.js
- sectionController.js
- subSectionController.js
- mysqlSubSectionController.js
- mysqlSubSectionTransferController.js
- userController.js
- roleController.js
- permissionController.js
- mealController.js
- attendanceController.js

### ➕ Need to Add (Not tracked yet)
- Employee CRUD operations
- Sync operations (manual sync triggers)
- Cache operations
- Report operations

## Migration Steps

1. **Find all RecentActivity.create() calls**
   ```bash
   grep -r "RecentActivity.create" backend/controllers/
   ```

2. **Replace with logRecentActivity**
   - Import: `const { logRecentActivity } = require('../services/activityLogService');`
   - Remove: `const { RecentActivity } = require('../models/mysql');`
   - Remove: `const moment = require('moment');` (if only used for activity)
   - Remove: `icon`, `activity_date`, `activity_time` fields (auto-generated)

3. **Test FIFO Cleanup**
   - Create 51 activities
   - Verify oldest one is auto-deleted
   - Verify only 50 remain

## Frontend Display

The dashboard will show:
- Latest 50 activities (automatically maintained)
- Activity type icon (auto-assigned)
- User who performed action
- Timestamp (date + time)
- Entity affected (if applicable)

## Database Maintenance

No manual cleanup needed - FIFO happens automatically on each insert when count > 50.

## Performance

- Single insert + conditional delete
- Only queries oldest records when limit exceeded
- Minimal performance impact (< 10ms per activity log)
