# 📊 Audit System - Visual Reference & Cheat Sheet

**Purpose:** Quick visual reference guide  
**Format:** Diagrams, tables, and quick lookup references  
**Best Used:** Alongside the main documentation

---

## 🎯 The Audit System in One Page

### What It Does
```
┌──────────────────────────────────────────┐
│   Identifies Employees with Incomplete   │
│    Attendance Records (Missing Punches)  │
├──────────────────────────────────────────┤
│                                          │
│  Expected: 2 punches/day (IN + OUT)      │
│  Problem: Only 1 punch/day                │
│  Action: Generate audit report            │
│                                          │
└──────────────────────────────────────────┘
```

### How to Access
```
Frontend → Reports → Audit Report → Select Options → View Results
```

---

## 📋 Quick Reference Tables

### Grouping Modes at a Glance

```
╔════════════════╦═════════════════════╦══════════════════════╗
║ Mode           ║ Best For            ║ Output Format        ║
╠════════════════╬═════════════════════╬══════════════════════╣
║ PUNCH          ║ Compliance Audits   ║ Detailed Punch List  ║
║                ║ (Every punch listed)║ with Date/Time       ║
╟────────────────╢─────────────────────┼──────────────────────╢
║ DESIGNATION    ║ HR Analysis         ║ Grouped by Job Title ║
║                ║ (By role/title)     ║ with Employee Count  ║
╟────────────────╢─────────────────────┼──────────────────────╢
║ NONE (Summary) ║ Quick Overview      ║ Summary with Issue   ║
║                ║ (Repeat offenders)  ║ Counts per Employee  ║
╚════════════════╩═════════════════════╩══════════════════════╝
```

### When to Use Each Mode

| Use Case | Best Mode | Example |
|----------|-----------|---------|
| "Show me every missed check-out" | PUNCH | Check date/time of every incomplete record |
| "Which department has issues?" | DESIGNATION | Group by Manager/Developer/Analyst |
| "Who are our problem employees?" | NONE | Sort by highest issue count |
| "Audit compliance for period" | PUNCH | List all incomplete punches for evidence |
| "Present to management" | NONE | Summary report with statistics |
| "Employee discipline" | DESIGNATION | Find repeat offenders in their role |

---

## 🔍 Data Flow Diagram

### Simple Path (30,000 feet view)
```
User selects dates
         ↓
    User picks grouping mode
         ↓
    Submits form
         ↓
    Backend queries database
         ↓
    Applies grouping logic
         ↓
    Returns formatted results
         ↓
    Frontend displays in table
         ↓
    User can print or export
```

### Detailed Path (Technical)
```
┌────────────────────────────────────────────────────────────┐
│ 1. COLLECT ATTENDANCE DATA                                 │
├────────────────────────────────────────────────────────────┤
│ SELECT employee_ID, date_, time_, scan_type                │
│ FROM attendance                                            │
│ WHERE date_ BETWEEN from_date AND to_date                 │
│ GROUP BY employee_ID, date_                               │
│ HAVING COUNT(*) = 1  ← Only single punches                │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 2. ENRICH WITH EMPLOYEE DATA                               │
├────────────────────────────────────────────────────────────┤
│ JOIN with employees_sync table                             │
│ Get: employee_name, designation, division, section         │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 3. APPLY FILTERS (if provided)                             │
├────────────────────────────────────────────────────────────┤
│ WHERE division_id = ? AND section_id = ?                   │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 4. APPLY GROUPING LOGIC                                    │
├────────────────────────────────────────────────────────────┤
│ IF punch:       GROUP BY scan_type                         │
│ IF designation: GROUP BY designation                       │
│ IF none:        GROUP BY employee (count issues)           │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 5. FORMAT RESPONSE                                         │
├────────────────────────────────────────────────────────────┤
│ {                                                          │
│   data: [ { groupName, employees, count, ... } ],         │
│   summary: { totalEmployees, totalRecords, ... },         │
│   dateRange: { from, to },                                │
│   grouping: 'punch'|'designation'|'none'                  │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ 6. DISPLAY IN UI                                           │
├────────────────────────────────────────────────────────────┤
│ Show expandable groups with tables                          │
│ Print-optimized layout                                     │
│ Summary statistics                                         │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 Example Outputs

### Example 1: PUNCH Mode Output

```
PUNCH TYPE AUDIT REPORT
Period: 2025-01-01 to 2025-01-31
Total Issues: 32 incomplete punches

╔════════════════════════════════════════════════════════════╗
║ CHECK IN ONLY (Missing Check Out) - 32 Records            ║
╠════════════════════════════════════════════════════════════╣
║ Emp ID │ Employee Name      │ Designation │ Date      │   ║
╠════════╪════════════════════╪════════════╪═══════════╣   ║
║ E001   │ John Smith         │ Manager    │ 01-10     │   ║
║ E003   │ Sarah Johnson      │ Developer  │ 01-10     │   ║
║ E005   │ Mark Davis         │ Analyst    │ 01-11     │   ║
║ ...    │ ...                │ ...        │ ...       │   ║
╚════════════════════════════════════════════════════════════╝

✓ Every incomplete punch is listed
✓ Shows exactly when it happened (date)
✓ Organized by punch type (IN vs OUT)
✓ Perfect for compliance audits
```

### Example 2: DESIGNATION Mode Output

```
DESIGNATION WISE AUDIT REPORT
Period: 2025-01-01 to 2025-01-31

╔════════════════════════════════════════════════════════╗
║ Developer (8 employees with issues)                    ║
╠════════════════════════════════════════════════════════╣
║ Emp ID │ Employee Name      │ Division               ║
╠════════╪════════════════════╪═══════════════════════╣
║ E001   │ John Smith         │ Information Technology ║
║ E003   │ Sarah Johnson      │ Information Technology ║
║ E007   │ Alex Brown         │ Information Technology ║
║ ...    │ ...                │ ...                   ║
╚════════════════════════════════════════════════════════╝

╔════════════════════════════════════════════════════════╗
║ Project Manager (3 employees with issues)             ║
╠════════════════════════════════════════════════════════╣
║ Emp ID │ Employee Name      │ Division               ║
╠════════╪════════════════════╪═══════════════════════╣
║ E002   │ Alice Wilson       │ Information Technology ║
║ E004   │ Bob Brown          │ Human Resources       ║
║ E006   │ Emma Davis         │ Finance               ║
╚════════════════════════════════════════════════════════╝

✓ Employees grouped by job title
✓ See which roles have problems
✓ Perfect for HR analysis by department
✓ Easy to identify role-specific patterns
```

### Example 3: NONE Mode (Summary) Output

```
AUDIT SUMMARY REPORT
Period: 2025-01-01 to 2025-01-31
Total Employees with Issues: 22

╔════════════════════════════════════════════════════════════╗
║ Employee Summary (Sorted by Issue Count)                  ║
╠════════════════════════════════════════════════════════════╣
║ Emp ID │ Name               │ Designation │ Issues │ Div  ║
╠════════╪════════════════════╪═════════════╪════════╪══════╣
║ E001   │ John Smith         │ Manager     │   12   │ IT   ║
║ E003   │ Sarah Johnson      │ Developer   │    8   │ IT   ║
║ E002   │ Alice Wilson       │ Manager     │    5   │ HR   ║
║ E005   │ Mark Davis         │ Analyst     │    4   │ IT   ║
║ E004   │ Bob Brown          │ Manager     │    3   │ HR   ║
║ E007   │ Alex Brown         │ Developer   │    2   │ IT   ║
║ ...    │ ...                │ ...         │  ...   │ ... ║
╚════════════════════════════════════════════════════════════╝

✓ Quick overview of problem employees
✓ Sorted by frequency (worst first)
✓ Easy to spot repeat offenders
✓ Good for executive reports
```

---

## 🔧 Quick Troubleshooting Guide

### Problem: No Results Returned

```
Step 1: Verify Data Exists
        ↓
        SELECT COUNT(*) FROM attendance WHERE date_ BETWEEN ? AND ?
        
        • Returns 0? → No data in that date range
        • Returns >0? → Continue to Step 2

Step 2: Verify Single Punch Records Exist
        ↓
        SELECT COUNT(DISTINCT employee_ID) FROM attendance
        WHERE date_ BETWEEN ? AND ?
        GROUP BY employee_ID, date_
        HAVING COUNT(*) = 1
        
        • Returns 0? → All employees have complete (2 punch) records
        • Returns >0? → Single punches exist. Issue is in code/API

Step 3: Check Filters
        ↓
        Are filters too restrictive?
        Try with no division/section filters first
        
        • Same result? → Verify API implementation
        • Different? → Filter logic needs adjustment
```

### Problem: Wrong Dates/Times Showing

```
Check These Fields:
├─ eventDate        should be YYYY-MM-DD
├─ eventTime        should be HH:MM:SS
├─ scan_type        should be IN or OUT
└─ employee_name    should populate correctly

If Wrong:
1. Verify SQL query pulls correct fields
2. Check database field names (date_ vs date)
3. Check time format (TIME vs VARCHAR)
```

### Problem: Grouping Not Working

```
Check the Grouping Value:
├─ punch       → ✓ Valid
├─ designation → ✓ Valid
├─ none        → ✓ Valid
└─ other       → ✗ Invalid (will use 'none')

If Grouping Ignored:
1. Verify request body includes grouping parameter
2. Check for typos in grouping value
3. Review grouping logic in auditModel.js
```

---

## 📈 Performance Reference

### Typical Query Times

```
Conditions                              | Expected Time
────────────────────────────────────────┼───────────────
1 month, no filters                     │ 100 - 200 ms
3 months, no filters                    │ 200 - 400 ms
1 year, no filters                      │ 400 - 800 ms
1 month, single division filter         │ 50 - 100 ms
1 month, single division + section      │ 30 - 80 ms
────────────────────────────────────────┴───────────────

Goal: Keep under 1000 ms (1 second)
```

### How to Improve Performance

```
If Slow:                                Action
────────────────────────────────────────┼──────────────────────
Long date range                         │ Reduce date range
Many employees                          │ Use division filter
No indexes on attendance table          │ Add indexes
Slow MySQL server                       │ Optimize DB server
────────────────────────────────────────┴──────────────────────
```

### Required Indexes

```sql
-- These indexes make queries fast
ALTER TABLE attendance ADD INDEX idx_employee_date (employee_ID, date_);
ALTER TABLE attendance ADD INDEX idx_date (date_);
ALTER TABLE attendance ADD INDEX idx_scan_type (scan_type);

-- Check if they exist
SHOW INDEX FROM attendance;
```

---

## 🔐 Data Validation Rules

### Input Validation

```
Parameter               Validation Rule
────────────────────────┬────────────────────────────
from_date              │ Required, YYYY-MM-DD format
to_date                │ Required, YYYY-MM-DD format
from_date < to_date    │ Must be true
grouping               │ 'punch' | 'designation' | 'none'
division_id            │ Optional, alphanumeric
section_id             │ Optional, alphanumeric
sub_section_id         │ Optional, alphanumeric
────────────────────────┴────────────────────────────
```

### Output Validation

```
Response Field         Should Contain
────────────────────────┬────────────────────────────
success                │ true (if no error)
data                   │ Array of grouped results
summary                │ Statistics object
dateRange              │ { from, to }
grouping               │ 'punch'|'designation'|'none'
────────────────────────┴────────────────────────────
```

---

## 📞 Common API Calls

### Call 1: Get all incomplete punches (Compliance Audit)

```bash
curl -X POST http://localhost:5000/api/reports/audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "from_date": "2025-01-01",
    "to_date": "2025-01-31",
    "grouping": "punch"
  }'
```

### Call 2: Get employees by designation (HR Analysis)

```bash
curl -X POST http://localhost:5000/api/reports/audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "from_date": "2025-01-01",
    "to_date": "2025-01-31",
    "grouping": "designation",
    "division_id": "IT"
  }'
```

### Call 3: Get summary with filters (Quick Report)

```bash
curl -X POST http://localhost:5000/api/reports/audit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "from_date": "2025-01-01",
    "to_date": "2025-01-31",
    "grouping": "none",
    "division_id": "IT",
    "section_id": "DEV001"
  }'
```

---

## 🎯 Decision Tree: Which Mode to Use?

```
START: Need an audit report?
│
├─ Need every single incomplete punch listed?
│  └─→ USE: PUNCH MODE ✓
│     (Compliance, Legal evidence, Detailed analysis)
│
├─ Need to see which ROLES have problems?
│  └─→ USE: DESIGNATION MODE ✓
│     (HR department analysis, Training needs)
│
├─ Need quick overview of problem EMPLOYEES?
│  └─→ USE: NONE MODE (Summary) ✓
│     (Executive report, Identifying repeat offenders)
│
└─ Not sure?
   └─→ START WITH: NONE MODE
      (Best for quick understanding, then drill down)
```

---

## 📚 Field Name Reference

### In MySQL `attendance` table:
```
employee_ID    → Employee identifier
date_          → Attendance date (YYYY-MM-DD)
time_          → Punch time (HH:MM:SS)
scan_type      → Type: 'IN', 'OUT', '08', '46', etc.
```

### In MySQL `employees_sync` table:
```
EMP_NO         → Employee ID (matches employee_ID)
EMP_NAME       → Employee full name
EMP_DESIGNATION→ Job title
DIV_CODE       → Division code
DIV_NAME       → Division name
SEC_CODE       → Section code
SEC_NAME       → Section name
IS_ACTIVE      → Active flag
```

### In API Response:
```
groupName      → Group title (e.g., "Developer")
employees      → Array of employee records
count          → Number of records in group
totalRecords   → Total records in response
totalEmployees → Unique employee count
```

---

## ✅ Implementation Checklist (Quick Version)

- [ ] **Verify Database**
  - [ ] attendance table has data
  - [ ] employees_sync table populated
  - [ ] Field names match documentation

- [ ] **Test API**
  - [ ] POST request returns 200 status
  - [ ] Response has expected structure
  - [ ] Data matches database

- [ ] **Test All Modes**
  - [ ] Punch grouping works
  - [ ] Designation grouping works
  - [ ] None (summary) mode works

- [ ] **Test Filters**
  - [ ] Division filter works
  - [ ] Section filter works
  - [ ] Combined filters work

- [ ] **Test UI**
  - [ ] Can select dates
  - [ ] Can select grouping
  - [ ] Results display correctly
  - [ ] Print works

- [ ] **Deploy**
  - [ ] Code ready
  - [ ] Tests passing
  - [ ] Documentation updated
  - [ ] Users trained

---

## 🎓 Legend & Symbols

```
✓     → Working / Good / Recommended
✗     → Not working / Bad / Not recommended
⚠️     → Warning / Needs attention
ℹ️     → Information / Note
→     → Arrow / Flow direction
[x]   → Completed task
[ ]   → Pending task
```

---

**Print this page for quick reference while implementing!** 📋

