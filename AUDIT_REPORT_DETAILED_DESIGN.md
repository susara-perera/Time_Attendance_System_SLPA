# Audit Report - System Purpose and Design

## What is an Audit Report?

In the context of this SLPA Time & Attendance System, an **Audit Report** is **NOT** a system audit log, but rather a **detailed attendance punch records report**. It provides comprehensive visibility into employee punch-in and punch-out activities.

### Important Distinction
- **Audit Reports:** Employee attendance punch data from MySQL `attendance` table
- **System Audit Logs:** System events and changes (stored in MongoDB, not used for audit reports)

### Purpose of Audit Report

**Primary Purpose:** Review and audit employee attendance patterns to ensure:
1. ✓ Employees are clocking in/out at correct times
2. ✓ Identify missing punches or anomalies
3. ✓ Verify attendance compliance
4. ✓ Department-wise attendance tracking
5. ✓ Compensation and benefits calculation verification

### Who Uses It?

- HR Managers
- Departmental Heads
- Attendance Auditors
- Finance (for payroll verification)
- Compliance Officers

---

## What Data Does the System Need?

### Required Data Sources
- **Table:** MySQL `attendance` table
- **Record Type:** Individual punch events (IN/OUT)
- **Fields Needed:**
  - `employee_id` - Employee identifier
  - `employee_name` - Full name
  - `designation` - Job title/position
  - `event_time` - Date and time of punch
  - `division_name` - Department/Division
  - `section_name` - Section within division
  - `scan_type` - Type of punch (IN/OUT)

### Optional Filters
- **Division:** Filter by department
- **Section:** Filter by sub-department
- **Sub-section:** Filter by specific work unit
- **Date Range:** Period to audit (required)

### Data Quality Requirements
- Event times must be in valid datetime format
- Employee IDs must exist in employee master
- Division/Section names must match exactly
- No null/missing critical fields

---

## Report Grouping Logic

### 1. F1-0 (Punch Type) Grouping

**Purpose:** See all punches organized by type (Entry vs Exit)

**Logic:**
```
attendance records → Group by scan_type (IN/OUT) → Sort chronologically
```

**What You See:**
- **Group 1: "IN - Entry Punch"**
  - All employee IN punches for date range
  - Sorted by time of occurrence
  - Shows: Employee ID, Name, Designation, Date, Time

- **Group 2: "OUT - Exit Punch"**
  - All employee OUT punches for date range
  - Sorted by time of occurrence
  - Shows: Employee ID, Name, Designation, Date, Time

**Use Case:** Audit entry/exit patterns, identify early departures

**Example Output:**
```
IN - Entry Punch (245 records)
├─ EMP001 | John Doe      | Manager    | 2025-01-10 | 08:30:45
├─ EMP002 | Jane Smith    | Executive  | 2025-01-10 | 09:15:30
└─ EMP003 | Bob Johnson   | Clerk      | 2025-01-10 | 08:00:00

OUT - Exit Punch (240 records)
├─ EMP001 | John Doe      | Manager    | 2025-01-10 | 17:30:20
├─ EMP003 | Bob Johnson   | Clerk      | 2025-01-10 | 16:45:00
└─ EMP002 | Jane Smith    | Executive  | 2025-01-10 | 18:15:10
```

---

### 2. Designation Wise Grouping

**Purpose:** See employees grouped by their job title/position

**Logic:**
```
attendance records → Group by designation → Sort alphabetically
                                         → Sort employees by name
                                         → Sort punches chronologically
```

**What You See:**
- **Group: "Manager"**
  - All punch records for all managers
  - Sorted by employee name
  - Within each employee, sorted by time
  - Shows: Employee ID, Name, Designation, Date, Time

- **Group: "Executive"**
  - All punch records for executives
  - Same sorting as above

- **Group: "Clerk"**
  - All punch records for clerks
  - Same sorting as above

**Use Case:** Department audit, designation-wise attendance compliance

**Example Output:**
```
Clerk (120 records)
├─ EMP003 | Bob Johnson    | Clerk | 2025-01-10 | 08:00:00
├─ EMP003 | Bob Johnson    | Clerk | 2025-01-10 | 16:45:00
├─ EMP004 | Alice Brown    | Clerk | 2025-01-10 | 08:15:30
└─ EMP004 | Alice Brown    | Clerk | 2025-01-10 | 17:00:00

Executive (95 records)
├─ EMP002 | Jane Smith     | Executive | 2025-01-10 | 09:15:30
└─ EMP002 | Jane Smith     | Executive | 2025-01-10 | 18:15:10

Manager (30 records)
├─ EMP001 | John Doe       | Manager | 2025-01-10 | 08:30:45
└─ EMP001 | John Doe       | Manager | 2025-01-10 | 17:30:20
```

---

### 3. No Grouping (Default)

**Purpose:** Summary view by employee with punch counts

**Logic:**
```
attendance records → Group by employee_id → Count punches per employee
                                           → Sort by punch count (DESC)
```

**What You See:**
- **Single Group: "All Employees"**
  - One row per unique employee
  - Shows total punch count
  - Sorted by highest punch count first

**Use Case:** Quick overview of who has most activity

**Example Output:**
```
All Employees
├─ EMP003 | Bob Johnson    | Clerk    | 45 punches
├─ EMP001 | John Doe       | Manager  | 42 punches
├─ EMP004 | Alice Brown    | Clerk    | 38 punches
└─ EMP002 | Jane Smith     | Executive| 22 punches
```

---

## Data Retrieval Logic (Step-by-Step)

### Step 1: User Selection
```
1. Open Report Generation
2. Select: Report Type = "Audit Report"
3. Select: Grouping = "F1-0 (Punch Type)" OR "Designation Wise"
4. Select: Division/Section (optional, for filtering)
5. Select: Date Range (required: from_date to to_date)
6. Click: "Generate Report Now"
```

### Step 2: Frontend Processing
```
1. Validate:
   - ✓ Dates provided?
   - ✓ Dates in YYYY-MM-DD format?
   - ✓ from_date <= to_date?

2. Build API Payload:
   {
     "from_date": "2025-01-10",
     "to_date": "2025-01-15",
     "grouping": "punch" OR "designation",
     "division_id": "Marketing" (if selected),
     "section_id": "Digital" (if selected)
   }

3. Send POST request to /api/reports/mysql/audit
```

### Step 3: Backend Processing

**auditController.js:**
```
1. Receive request payload
2. Extract: from_date, to_date, grouping, division_id, section_id
3. Validate:
   - from_date and to_date provided?
   - Valid YYYY-MM-DD format?
   - from_date <= to_date?
4. Call auditModel.fetchAuditReport()
5. Return structured response
```

**auditModel.js:**
```
IF grouping === 'punch':
  1. Query attendance table:
     SELECT * WHERE event_time BETWEEN from_date AND to_date
  2. Filter by division/section if provided
  3. Group records by scan_type (IN/OUT)
  4. For each group:
     - Count records
     - Generate group name ("IN - Entry Punch" or "OUT - Exit Punch")
     - Keep employee details (ID, name, designation, date, time)
  5. Sort by event_time ascending
  6. Return grouped structure

ELSE IF grouping === 'designation':
  1. Query attendance table:
     SELECT * WHERE event_time BETWEEN from_date AND to_date
  2. Filter by division/section if provided
  3. Group records by designation
  4. For each designation:
     - Count records
     - Generate group name (designation value)
     - Keep employee details (ID, name, designation, date, time)
  5. Sort designations alphabetically, then employees, then by time
  6. Return grouped structure

ELSE:  // No grouping
  1. Query with GROUP BY employee_id
  2. Count punches per employee
  3. Sort by count DESC
  4. Return summary
```

### Step 4: Response to Frontend
```json
{
  "success": true,
  "data": [
    {
      "groupName": "IN - Entry Punch",
      "punchType": "IN",
      "count": 245,
      "employees": [
        {
          "employeeId": "EMP001",
          "employeeName": "John Doe",
          "designation": "Manager",
          "eventDate": "2025-01-10",
          "eventTime": "08:30:45",
          "divisionName": "Marketing",
          "sectionName": "Digital"
        }
      ]
    }
  ],
  "summary": {
    "totalEmployees": 150,
    "totalGroups": 2,
    "totalRecords": 495,
    "divisionFilter": "Marketing",
    "sectionFilter": "Digital"
  },
  "dateRange": {"from": "2025-01-10", "to": "2025-01-15"},
  "grouping": "punch"
}
```

### Step 5: Frontend Display
```
1. Receive response
2. Parse grouping type
3. Display AuditReport component:
   - Show summary cards (total records, employees, groups)
   - Show filter information (division, section, date range)
   - For each group:
     - Render group header with count
     - Render appropriate table based on grouping type
     - Include expandable sections
4. Provide print/export options
```

---

## Database Schema Requirements

### Attendance Table Structure
```sql
CREATE TABLE attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(20) NOT NULL,
  employee_name VARCHAR(100) NOT NULL,
  designation VARCHAR(100),
  event_time DATETIME NOT NULL,
  division_name VARCHAR(100),
  section_name VARCHAR(100),
  scan_type ENUM('IN', 'OUT') DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_event_time (event_time),
  INDEX idx_employee_id (employee_id),
  INDEX idx_division (division_name),
  INDEX idx_designation (designation)
);
```

### Key Fields Explained
| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| employee_id | VARCHAR(20) | Unique employee identifier | EMP001 |
| employee_name | VARCHAR(100) | Employee full name | John Doe |
| designation | VARCHAR(100) | Job title | Manager, Clerk |
| event_time | DATETIME | Punch timestamp | 2025-01-10 08:30:45 |
| division_name | VARCHAR(100) | Department | Marketing, IT |
| section_name | VARCHAR(100) | Sub-department | Digital, Sales |
| scan_type | ENUM | IN or OUT punch | IN, OUT |

---

## Summary Statistics Explained

### totalRecords
**Definition:** Total number of punch records in the report
**Calculation:** Count of all rows returned from attendance table
**Example:** If 495 punches occurred in date range, totalRecords = 495

### totalEmployees
**Definition:** Count of unique employees with punches in the report
**Calculation:** COUNT(DISTINCT employee_id)
**Example:** If 150 different employees punched in/out, totalEmployees = 150

### totalGroups
**Definition:** Number of groups in the report
**For punch grouping:** Always 2 (IN and OUT), or 1 if only one type exists
**For designation grouping:** Number of unique designations
**Example:** If 3 designations (Manager, Executive, Clerk), totalGroups = 3

### Filters Applied
**divisionFilter:** Which division was selected (or "All")
**sectionFilter:** Which section was selected (or "All")
**subSectionFilter:** Which sub-section was selected (or "All")

---

## Example Report Flow

### User Action
```
1. Login as HR Manager
2. Navigate to Report Generation
3. Select Report Type: "Audit Report"
4. Select Grouping: "Designation Wise"
5. Select Division: "Marketing"
6. Keep Section: "All"
7. Select Dates: 2025-01-10 to 2025-01-12
8. Click "Generate Report Now"
```

### System Processing
```
Frontend sends:
{
  "from_date": "2025-01-10",
  "to_date": "2025-01-12",
  "grouping": "designation",
  "division_id": "Marketing",
  "section_id": ""
}

Backend executes:
SELECT designation, employee_id, employee_name, 
       DATE(event_time), TIME(event_time), division_name, section_name
FROM attendance
WHERE event_time BETWEEN '2025-01-10 00:00:00' AND '2025-01-12 23:59:59'
  AND division_name = 'Marketing'
ORDER BY designation, employee_name, event_time

Database returns:
Manager      | EMP001 | John Doe   | 2025-01-10 | 08:30:45
Manager      | EMP001 | John Doe   | 2025-01-10 | 17:30:20
Executive    | EMP002 | Jane Smith | 2025-01-10 | 09:15:30
Executive    | EMP002 | Jane Smith | 2025-01-10 | 18:15:10
Clerk        | EMP003 | Bob Johnson| 2025-01-10 | 08:00:00
...
```

### Report Display
```
SLPA DESIGNATION WISE AUDIT REPORT
Date: 2025-01-10 to 2025-01-12
Division: Marketing

Summary:
- Total Records: 147
- Affected Employees: 42
- Report Groups: 3

[Clerk] - 45 employees
  - EMP003 | Bob Johnson | Clerk | 2025-01-10 | 08:00:00
  - EMP003 | Bob Johnson | Clerk | 2025-01-10 | 16:45:00
  ...

[Executive] - 95 employees
  - EMP002 | Jane Smith | Executive | 2025-01-10 | 09:15:30
  - EMP002 | Jane Smith | Executive | 2025-01-10 | 18:15:10
  ...

[Manager] - 30 employees
  - EMP001 | John Doe | Manager | 2025-01-10 | 08:30:45
  - EMP001 | John Doe | Manager | 2025-01-10 | 17:30:20
  ...
```

---

## Design Principles

### 1. **Data Integrity**
- All data comes directly from MySQL attendance table
- No data transformation or estimation
- Exact timestamps preserved

### 2. **Clarity**
- Clear grouping options with obvious purpose
- Summary statistics for quick understanding
- Filterable and drillable data

### 3. **Flexibility**
- Support multiple grouping strategies
- Optional division/section filtering
- Configurable date ranges

### 4. **Auditability**
- All parameters logged
- Date/time information included
- Employee details always visible

### 5. **Performance**
- Indexed database queries
- Limited to 50,000 records
- Client-side grouping post-fetch for large datasets

---

## Audit Trail for Report Generation

Every audit report generation is logged with:
- Date/time of report generation
- Who generated it (user ID)
- Parameters used (date range, grouping, filters)
- Number of records returned
- Duration of query

This ensures:
✓ Compliance with audit requirements
✓ Traceability of report access
✓ Security monitoring
✓ Performance tracking
