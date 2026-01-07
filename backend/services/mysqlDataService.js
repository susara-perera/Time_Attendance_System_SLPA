/**
 * MySQL Data Service - Raw SQL Implementation
 * 
 * Replaces HRIS API calls with fast MySQL queries from sync tables
 * All data is sourced from divisions_sync, sections_sync, employees_sync
 */

const { sequelize } = require('../config/mysql');

/**
 * Get divisions from MySQL with filtering and search
 */
const getDivisionsFromMySQL = async (filters = {}) => {
  try {
    let whereClause = '';
    const replacements = {};

    // Search filter
    if (filters.search) {
      whereClause = `WHERE (HIE_NAME LIKE :search OR HIE_CODE LIKE :search OR HIE_NAME_SINHALA LIKE :search)`;
      replacements.search = `%${filters.search}%`;
    }

    // Status filter (default to ACTIVE)
    if (filters.status) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += `STATUS = :status`;
      replacements.status = filters.status;
    }

    const [divisions] = await sequelize.query(
      `SELECT * FROM divisions_sync ${whereClause} ORDER BY HIE_NAME ASC`,
      {
        replacements,
        nest: false,
        raw: true
      }
    );

    return divisions.map(div => ({
      _id: `mysql_div_${div.HIE_CODE}`,
      HIE_CODE: div.HIE_CODE,
      HIE_NAME: div.HIE_NAME,
      HIE_NAME_SINHALA: div.HIE_NAME_SINHALA,
      HIE_NAME_TAMIL: div.HIE_NAME_TAMIL,
      HIE_RELATIONSHIP: div.HIE_RELATIONSHIP,
      DEF_LEVEL: div.DEF_LEVEL,
      STATUS: div.STATUS,
      DESCRIPTION: div.DESCRIPTION,
      code: div.HIE_CODE,
      name: div.HIE_NAME,
      synced_at: div.synced_at,
      source: 'MySQL'
    }));

  } catch (error) {
    console.error('❌ [MySQL] Error fetching divisions:', error.message);
    throw error;
  }
};

/**
 * Get single division by code
 */
const getDivisionFromMySQL = async (hieCode) => {
  try {
    const divisions = await sequelize.query(
      `SELECT * FROM divisions_sync WHERE HIE_CODE = :hieCode LIMIT 1`,
      {
        replacements: { hieCode },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!divisions || divisions.length === 0) return null;
    
    const div = divisions[0];
    return {
      _id: `mysql_div_${div.HIE_CODE}`,
      HIE_CODE: div.HIE_CODE,
      HIE_NAME: div.HIE_NAME,
      HIE_NAME_SINHALA: div.HIE_NAME_SINHALA,
      HIE_NAME_TAMIL: div.HIE_NAME_TAMIL,
      HIE_RELATIONSHIP: div.HIE_RELATIONSHIP,
      DEF_LEVEL: div.DEF_LEVEL,
      STATUS: div.STATUS,
      DESCRIPTION: div.DESCRIPTION,
      code: div.HIE_CODE,
      name: div.HIE_NAME,
      synced_at: div.synced_at,
      source: 'MySQL'
    };

  } catch (error) {
    console.error('❌ [MySQL] Error fetching division:', error.message);
    throw error;
  }
};

/**
 * Get sections from MySQL with filtering
 */
const getSectionsFromMySQL = async (filters = {}) => {
  try {
    let whereClause = '';
    const replacements = {};

    // Search filter
    if (filters.search) {
      whereClause = `WHERE (HIE_NAME LIKE :search OR HIE_CODE LIKE :search OR HIE_NAME_SINHALA LIKE :search)`;
      replacements.search = `%${filters.search}%`;
    }

    // Division filter
    if (filters.divisionCode) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += `HIE_RELATIONSHIP = :divisionCode`;
      replacements.divisionCode = filters.divisionCode;
    }

    // Status filter
    if (filters.status) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += `STATUS = :status`;
      replacements.status = filters.status;
    }

    const [sections] = await sequelize.query(
      `SELECT * FROM sections_sync ${whereClause} ORDER BY HIE_NAME ASC`,
      {
        replacements,
        nest: false,
        raw: true
      }
    );

    return sections.map(sec => ({
      _id: `mysql_sec_${sec.HIE_CODE}`,
      HIE_CODE: sec.HIE_CODE,
      HIE_NAME: sec.HIE_NAME,
      HIE_NAME_SINHALA: sec.HIE_NAME_SINHALA,
      HIE_NAME_TAMIL: sec.HIE_NAME_TAMIL,
      HIE_RELATIONSHIP: sec.HIE_RELATIONSHIP,
      DEF_LEVEL: sec.DEF_LEVEL,
      STATUS: sec.STATUS,
      DESCRIPTION: sec.DESCRIPTION,
      code: sec.HIE_CODE,
      name: sec.HIE_NAME,
      division_code: sec.HIE_RELATIONSHIP,
      synced_at: sec.synced_at,
      source: 'MySQL'
    }));

  } catch (error) {
    console.error('❌ [MySQL] Error fetching sections:', error.message);
    throw error;
  }
};

/**
 * Get single section by code
 */
const getSectionFromMySQL = async (hieCode) => {
  try {
    const sections = await sequelize.query(
      `SELECT * FROM sections_sync WHERE HIE_CODE = :hieCode LIMIT 1`,
      {
        replacements: { hieCode },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!sections || sections.length === 0) return null;
    
    const sec = sections[0];
    return {
      _id: `mysql_sec_${sec.HIE_CODE}`,
      HIE_CODE: sec.HIE_CODE,
      HIE_NAME: sec.HIE_NAME,
      HIE_NAME_SINHALA: sec.HIE_NAME_SINHALA,
      HIE_NAME_TAMIL: sec.HIE_NAME_TAMIL,
      HIE_RELATIONSHIP: sec.HIE_RELATIONSHIP,
      DEF_LEVEL: sec.DEF_LEVEL,
      STATUS: sec.STATUS,
      DESCRIPTION: sec.DESCRIPTION,
      code: sec.HIE_CODE,
      name: sec.HIE_NAME,
      division_code: sec.HIE_RELATIONSHIP,
      synced_at: sec.synced_at,
      source: 'MySQL'
    };

  } catch (error) {
    console.error('❌ [MySQL] Error fetching section:', error.message);
    throw error;
  }
};

/**
 * Get subsections from MySQL with filtering
 */
const getSubSectionsFromMySQL = async (filters = {}) => {
  try {
    let whereClause = '';
    const replacements = {};

    // Section filter
    if (filters.sectionCode) {
      whereClause = `WHERE section_code = :sectionCode`;
      replacements.sectionCode = filters.sectionCode;
    }

    // Division filter (if provided)
    if (filters.divisionCode) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += `division_code = :divisionCode`;
      replacements.divisionCode = filters.divisionCode;
    }

    const [subsections] = await sequelize.query(
      `SELECT * FROM sub_sections ${whereClause} ORDER BY sub_name ASC`,
      {
        replacements,
        nest: false,
        raw: true
      }
    );

    return subsections.map(sub => ({
      _id: String(sub.id),
      id: sub.id,
      sub_name: sub.sub_name,
      sub_code: sub.sub_code,
      section_code: sub.section_code,
      division_code: sub.division_code,
      section_name: sub.section_name,
      division_name: sub.division_name,
      created_at: sub.created_at,
      updated_at: sub.updated_at,
      source: 'MySQL'
    }));

  } catch (error) {
    console.error('❌ [MySQL] Error fetching subsections:', error.message);
    throw error;
  }
};

/**
 * Get employees from MySQL with filtering
 */
const getEmployeesFromMySQL = async (filters = {}) => {
  try {
    let whereClause = '';
    const replacements = {};

    // Exclude transferred employees (those with transferred_status = TRUE)
    // Use LEFT JOIN to find employees NOT in transferred_employees with TRUE status
    let joinClause = `
      LEFT JOIN transferred_employees te 
      ON employees_sync.EMP_NO = te.employee_id AND te.transferred_status = TRUE
    `;
    whereClause = `WHERE te.id IS NULL`; // Only include employees not transferred

    // Search filter
    if (filters.search) {
      whereClause += ` AND (EMP_NAME LIKE :search OR EMP_NO LIKE :search OR EMP_NIC LIKE :search OR EMP_EMAIL LIKE :search)`;
      replacements.search = `%${filters.search}%`;
    }

    // Division filter
    if (filters.divisionCode) {
      whereClause += ` AND DIV_CODE = :divisionCode`;
      replacements.divisionCode = filters.divisionCode;
    }

    // Section filter
    if (filters.sectionCode) {
      whereClause += ` AND SEC_CODE = :sectionCode`;
      replacements.sectionCode = filters.sectionCode;
    }

    // Designation filter
    if (filters.designation) {
      whereClause += ` AND EMP_DESIGNATION LIKE :designation`;
      replacements.designation = `%${filters.designation}%`;
    }

    const [employees] = await sequelize.query(
      `SELECT employees_sync.* FROM employees_sync ${joinClause} ${whereClause} ORDER BY EMP_NAME ASC`,
      {
        replacements,
        nest: false,
        raw: true
      }
    );

    return employees.map(emp => ({
      _id: `mysql_emp_${emp.EMP_NO}`,
      EMP_NO: emp.EMP_NO,
      EMP_NAME: emp.EMP_NAME,
      EMP_NAME_WITH_INITIALS: emp.EMP_NAME_WITH_INITIALS,
      EMP_FIRST_NAME: emp.EMP_FIRST_NAME,
      EMP_LAST_NAME: emp.EMP_LAST_NAME,
      EMP_NIC: emp.EMP_NIC,
      EMP_EMAIL: emp.EMP_EMAIL,
      EMP_PHONE: emp.EMP_PHONE,
      EMP_MOBILE: emp.EMP_MOBILE,
      EMP_ADDRESS: emp.EMP_ADDRESS,
      EMP_GENDER: emp.EMP_GENDER,
      EMP_STATUS: emp.EMP_STATUS,
      EMP_TYPE: emp.EMP_TYPE,
      EMP_DESIGNATION: emp.EMP_DESIGNATION,
      EMP_GRADE: emp.EMP_GRADE,
      EMP_DATE_JOINED: emp.EMP_DATE_JOINED,
      EMP_DATE_PERMANENT: emp.EMP_DATE_PERMANENT,
      EMP_DATE_RETIRE: emp.EMP_DATE_RETIRE,
      DIV_CODE: emp.DIV_CODE,
      DIV_NAME: emp.DIV_NAME,
      SEC_CODE: emp.SEC_CODE,
      SEC_NAME: emp.SEC_NAME,
      DEPT_CODE: emp.DEPT_CODE,
      DEPT_NAME: emp.DEPT_NAME,
      HIE_CODE: emp.HIE_CODE,
      HIE_NAME: emp.HIE_NAME,
      LOCATION: emp.LOCATION,
      COST_CENTER: emp.COST_CENTER,
      STATUS: emp.STATUS,
      IS_ACTIVE: emp.IS_ACTIVE,
      employeeId: emp.EMP_NO,
      name: emp.EMP_NAME,
      synced_at: emp.synced_at,
      source: 'MySQL'
    }));

  } catch (error) {
    console.error('❌ [MySQL] Error fetching employees:', error.message);
    throw error;
  }
};

/**
 * Get single employee by number
 */
const getEmployeeFromMySQL = async (empNo) => {
  try {
    const employees = await sequelize.query(
      `SELECT * FROM employees_sync WHERE EMP_NO = :empNo LIMIT 1`,
      {
        replacements: { empNo },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!employees || employees.length === 0) return null;
    
    const emp = employees[0];
    return {
      _id: `mysql_emp_${emp.EMP_NO}`,
      EMP_NO: emp.EMP_NO,
      EMP_NAME: emp.EMP_NAME,
      EMP_NAME_WITH_INITIALS: emp.EMP_NAME_WITH_INITIALS,
      EMP_FIRST_NAME: emp.EMP_FIRST_NAME,
      EMP_LAST_NAME: emp.EMP_LAST_NAME,
      EMP_NIC: emp.EMP_NIC,
      EMP_EMAIL: emp.EMP_EMAIL,
      EMP_PHONE: emp.EMP_PHONE,
      EMP_MOBILE: emp.EMP_MOBILE,
      EMP_ADDRESS: emp.EMP_ADDRESS,
      EMP_GENDER: emp.EMP_GENDER,
      EMP_STATUS: emp.EMP_STATUS,
      EMP_TYPE: emp.EMP_TYPE,
      EMP_DESIGNATION: emp.EMP_DESIGNATION,
      EMP_GRADE: emp.EMP_GRADE,
      EMP_DATE_JOINED: emp.EMP_DATE_JOINED,
      EMP_DATE_PERMANENT: emp.EMP_DATE_PERMANENT,
      EMP_DATE_RETIRE: emp.EMP_DATE_RETIRE,
      DIV_CODE: emp.DIV_CODE,
      DIV_NAME: emp.DIV_NAME,
      SEC_CODE: emp.SEC_CODE,
      SEC_NAME: emp.SEC_NAME,
      DEPT_CODE: emp.DEPT_CODE,
      DEPT_NAME: emp.DEPT_NAME,
      HIE_CODE: emp.HIE_CODE,
      HIE_NAME: emp.HIE_NAME,
      LOCATION: emp.LOCATION,
      COST_CENTER: emp.COST_CENTER,
      STATUS: emp.STATUS,
      IS_ACTIVE: emp.IS_ACTIVE,
      employeeId: emp.EMP_NO,
      name: emp.EMP_NAME,
      synced_at: emp.synced_at,
      source: 'MySQL'
    };

  } catch (error) {
    console.error('❌ [MySQL] Error fetching employee:', error.message);
    throw error;
  }
};

/**
 * Get employee count by division
 */
const getEmployeeCountByDivision = async (divisionCode) => {
  try {
    const [[{ count }]] = await sequelize.query(
      `SELECT COUNT(*) as count FROM employees_sync WHERE DIV_CODE = :divisionCode`,
      {
        replacements: { divisionCode }
      }
    );

    return parseInt(count);

  } catch (error) {
    console.error('❌ [MySQL] Error counting employees by division:', error.message);
    return 0;
  }
};

/**
 * Get employee count by section
 */
const getEmployeeCountBySection = async (sectionCode) => {
  try {
    const [[{ count }]] = await sequelize.query(
      `SELECT COUNT(*) as count FROM employees_sync WHERE SEC_CODE = :sectionCode`,
      {
        replacements: { sectionCode }
      }
    );

    return parseInt(count);

  } catch (error) {
    console.error('❌ [MySQL] Error counting employees by section:', error.message);
    return 0;
  }
};

/**
 * Get total counts (fast)
 */
const getTotalCounts = async () => {
  try {
    const [[divCount]] = await sequelize.query('SELECT COUNT(*) as count FROM divisions_sync');
    const [[secCount]] = await sequelize.query('SELECT COUNT(*) as count FROM sections_sync');
    const [[empCount]] = await sequelize.query('SELECT COUNT(*) as count FROM employees_sync');

    return {
      divisions: parseInt(divCount.count),
      sections: parseInt(secCount.count),
      employees: parseInt(empCount.count)
    };

  } catch (error) {
    console.error('❌ [MySQL] Error getting total counts:', error.message);
    return { divisions: 0, sections: 0, employees: 0 };
  }
};

module.exports = {
  // Divisions
  getDivisionsFromMySQL,
  getDivisionFromMySQL,
  getEmployeeCountByDivision,
  
  // Sections
  getSectionsFromMySQL,
  getSectionFromMySQL,
  getEmployeeCountBySection,
  
  // Subsections
  getSubSectionsFromMySQL,
  
  // Employees
  getEmployeesFromMySQL,
  getEmployeeFromMySQL,
  
  // Totals
  getTotalCounts
};
