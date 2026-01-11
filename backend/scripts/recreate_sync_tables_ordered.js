/**
 * Recreate Sync Tables with Clean Ascending Order
 * 
 * This script:
 * 1. Drops existing divisions_sync, sections_sync, employees_sync tables
 * 2. Recreates them with AUTO_INCREMENT starting from 1
 * 3. Re-syncs data from HRIS in ASCENDING ORDER by primary key
 * 
 * This ensures InnoDB stores data in optimal physical order, preventing
 * page splits and fragmentation, which significantly boosts read performance.
 */

require('dotenv').config();
const { sequelize, DivisionSync, SectionSync, EmployeeSync } = require('../models/mysql');
const { login, readData } = require('../services/hrisApiService');

/**
 * Recreate a table with fresh AUTO_INCREMENT
 */
async function recreateTable(model, tableName) {
  try {
    console.log(`\n🗑️  Dropping ${tableName} table...`);
    await sequelize.query(`DROP TABLE IF EXISTS ${tableName}`);
    console.log(`   ✅ Dropped`);

    console.log(`📋 Creating fresh ${tableName} table...`);
    await model.sync({ force: true });
    console.log(`   ✅ Created with AUTO_INCREMENT=1`);
    
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to recreate ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Sync divisions in ASCENDING ORDER by HIE_CODE
 */
async function syncDivisionsOrdered() {
  console.log('\n🔄 Syncing Divisions in ASCENDING ORDER...');
  
  try {
    // Fetch from HRIS
    const hierarchy = await readData('company_hierarchy', {});
    let divisions = hierarchy.filter(item => 
      item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3'
    );

    console.log(`   📊 Found ${divisions.length} divisions`);

    // Sort by HIE_CODE in ASCENDING NUMERICAL ORDER
    divisions.sort((a, b) => {
      const codeA = parseInt(a.HIE_CODE) || 0;
      const codeB = parseInt(b.HIE_CODE) || 0;
      return codeA - codeB;
    });

    console.log(`   🔢 Sorted by HIE_CODE (ascending)`);

    let inserted = 0;
    let failed = 0;

    // Insert in order (this will use AUTO_INCREMENT 1, 2, 3, ...)
    for (const division of divisions) {
      try {
        await DivisionSync.create({
          HIE_CODE: division.HIE_CODE || `DIV_${Date.now()}_${Math.random()}`,
          HIE_NAME: division.HIE_NAME || 'Unknown Division',
          HIE_NAME_SINHALA: division.HIE_NAME_SINHALA || division.HIE_NAME_2 || null,
          HIE_NAME_TAMIL: division.HIE_NAME_TAMIL || null,
          HIE_RELATIONSHIP: division.HIE_RELATIONSHIP || null,
          DEF_LEVEL: parseInt(division.DEF_LEVEL) || 3,
          STATUS: division.STATUS || 'ACTIVE',
          DESCRIPTION: division.DESCRIPTION || null,
          synced_at: new Date()
        });
        inserted++;
      } catch (error) {
        console.error(`   ⚠️  Failed to insert ${division.HIE_CODE}:`, error.message);
        failed++;
      }
    }

    console.log(`   ✅ Inserted ${inserted} divisions (IDs: 1 to ${inserted})`);
    if (failed > 0) console.log(`   ⚠️  Failed: ${failed}`);
    
    return { inserted, failed };
  } catch (error) {
    console.error(`   ❌ Division sync failed:`, error.message);
    throw error;
  }
}

/**
 * Sync sections in ASCENDING ORDER by HIE_CODE
 */
async function syncSectionsOrdered() {
  console.log('\n🔄 Syncing Sections in ASCENDING ORDER...');
  
  try {
    // Fetch from HRIS
    const hierarchy = await readData('company_hierarchy', {});
    let sections = hierarchy.filter(item => 
      item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4'
    );

    console.log(`   📊 Found ${sections.length} sections`);

    // Sort by HIE_CODE in ASCENDING NUMERICAL ORDER
    sections.sort((a, b) => {
      const codeA = parseInt(a.HIE_CODE) || 0;
      const codeB = parseInt(b.HIE_CODE) || 0;
      return codeA - codeB;
    });

    console.log(`   🔢 Sorted by HIE_CODE (ascending)`);

    let inserted = 0;
    let failed = 0;

    // Insert in order (this will use AUTO_INCREMENT 1, 2, 3, ...)
    for (const section of sections) {
      try {
        await SectionSync.create({
          HIE_CODE: section.HIE_CODE || `SEC_${Date.now()}_${Math.random()}`,
          HIE_CODE_3: section.HIE_CODE_3 || null,
          HIE_NAME: section.HIE_NAME || null,
          HIE_NAME_3: section.HIE_NAME_3 || null,
          HIE_NAME_4: section.HIE_NAME_4 || section.HIE_NAME || 'Unknown Section',
          HIE_NAME_SINHALA: section.HIE_NAME_SINHALA || section.HIE_NAME_2 || null,
          HIE_NAME_TAMIL: section.HIE_NAME_TAMIL || null,
          HIE_RELATIONSHIP: section.HIE_RELATIONSHIP || null,
          SECTION_ID: section.SECTION_ID || section.HIE_CODE || null,
          DEF_LEVEL: parseInt(section.DEF_LEVEL) || 4,
          STATUS: section.STATUS || 'ACTIVE',
          DESCRIPTION: section.DESCRIPTION || null,
          synced_at: new Date()
        });
        inserted++;
      } catch (error) {
        console.error(`   ⚠️  Failed to insert ${section.HIE_CODE}:`, error.message);
        failed++;
      }
    }

    console.log(`   ✅ Inserted ${inserted} sections (IDs: 1 to ${inserted})`);
    if (failed > 0) console.log(`   ⚠️  Failed: ${failed}`);
    
    return { inserted, failed };
  } catch (error) {
    console.error(`   ❌ Section sync failed:`, error.message);
    throw error;
  }
}

/**
 * Sync employees in ASCENDING ORDER by EMP_NO
 */
async function syncEmployeesOrdered() {
  console.log('\n🔄 Syncing Employees in ASCENDING ORDER...');
  
  try {
    // Fetch from HRIS
    const employees = await readData('employee', {});
    let activeEmployees = employees.filter(emp => emp.ACTIVE_HRM_FLG === 1);

    console.log(`   📊 Found ${activeEmployees.length} active employees`);

    // Sort by EMP_NO in ASCENDING ORDER
    activeEmployees.sort((a, b) => {
      const empNoA = String(a.EMP_NUMBER || a.EMP_NO || '');
      const empNoB = String(b.EMP_NUMBER || b.EMP_NO || '');
      return empNoA.localeCompare(empNoB);
    });

    console.log(`   🔢 Sorted by EMP_NO (ascending)`);

    const parseHrisDate = (dateVal) => {
      if (!dateVal) return null;
      if (typeof dateVal === 'string') return dateVal;
      if (dateVal.$date && dateVal.$date.$numberLong) {
        return new Date(parseInt(dateVal.$date.$numberLong));
      }
      return null;
    };

    let inserted = 0;
    let failed = 0;

    // Insert in order (this will use AUTO_INCREMENT 1, 2, 3, ...)
    for (const employee of activeEmployees) {
      try {
        const currentWork = employee.currentwork || {};
        let address = [employee.PER_ADDRESS1, employee.PER_ADDRESS2, employee.PER_ADDRESS3]
          .filter(Boolean).join(', ');

        // Generate unique EMP_NO if missing
        const empNo = employee.EMP_NUMBER || employee.EMP_NO;
        if (!empNo) {
          console.warn(`   ⚠️  Skipping employee with no EMP_NO:`, employee);
          failed++;
          continue;
        }

        // Ensure EMP_NAME is not empty
        const empName = employee.FULLNAME || employee.EMP_NAME;
        if (!empName || empName.trim() === '') {
          console.warn(`   ⚠️  Skipping employee ${empNo} with no EMP_NAME`);
          failed++;
          continue;
        }

        await EmployeeSync.create({
          EMP_NO: empNo,
          EMP_NAME: empName,
          EMP_NAME_WITH_INITIALS: employee.DISPLAY_NAME || employee.EMP_NAME_WITH_INITIALS || null,
          EMP_FIRST_NAME: employee.FIRST_NAME || employee.EMP_FIRST_NAME || null,
          EMP_LAST_NAME: employee.LAST_NAME || employee.EMP_LAST_NAME || null,
          EMP_NIC: employee.NIC || employee.EMP_NIC || null,
          EMP_EMAIL: employee.PER_EMAIL || employee.EMP_EMAIL || null,
          EMP_PHONE: employee.PER_TELEPHONE || employee.EMP_PHONE || null,
          EMP_MOBILE: employee.PER_MOBILE || employee.EMP_MOBILE || null,
          EMP_ADDRESS: address || employee.EMP_ADDRESS || null,
          EMP_GENDER: employee.GENDER || employee.SEX || employee.gender || null,
          EMP_STATUS: employee.EMP_STATUS || 'ACTIVE',
          EMP_TYPE: employee.TYPE || employee.EMP_TYPE || null,
          EMP_DESIGNATION: currentWork.designation || employee.EMP_DESIGNATION || null,
          EMP_GRADE: employee.SAL_GRD_CODE || employee.EMP_GRADE || null,
          EMP_DATE_JOINED: parseHrisDate(employee.DATE_JOINED) || employee.EMP_DATE_JOINED || null,
          EMP_DATE_PERMANENT: parseHrisDate(employee.CONFIRM_DATE) || employee.EMP_DATE_PERMANENT || null,
          EMP_DATE_RETIRE: parseHrisDate(employee.RETIRE_DATE) || employee.EMP_DATE_RETIRE || null,
          DIV_CODE: employee.HIE_CODE_3 || employee.DIV_CODE || null,
          DIV_NAME: currentWork.HIE_NAME_3 || employee.DIV_NAME || null,
          SEC_CODE: employee.HIE_CODE_4 || employee.SEC_CODE || null,
          SEC_NAME: currentWork.HIE_NAME_4 || employee.SEC_NAME || null,
          DEPT_CODE: employee.HIE_CODE_2 || employee.DEPT_CODE || null,
          DEPT_NAME: currentWork.HIE_NAME_2 || employee.DEPT_NAME || null,
          HIE_CODE: employee.HIE_CODE || null,
          HIE_NAME: employee.HIE_NAME || null,
          LOCATION: employee.LOC_CODE || employee.LOCATION || null,
          COST_CENTER: employee.COST_CENTER || null,
          STATUS: 'ACTIVE',
          IS_ACTIVE: employee.ACTIVE_HRM_FLG === 1,
          synced_at: new Date()
        });
        inserted++;
      } catch (error) {
        console.error(`   ⚠️  Failed to insert ${employee.EMP_NO}:`, error.message);
        failed++;
      }
    }

    console.log(`   ✅ Inserted ${inserted} employees (IDs: 1 to ${inserted})`);
    if (failed > 0) console.log(`   ⚠️  Failed: ${failed}`);
    
    return { inserted, failed };
  } catch (error) {
    console.error(`   ❌ Employee sync failed:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🔄 RECREATE SYNC TABLES WITH ASCENDING ORDER             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    // Test MySQL connection
    await sequelize.authenticate();
    console.log('✅ MySQL Connected successfully to database:', sequelize.config.database);

    // Login to HRIS API
    console.log('\n🔐 Logging into HRIS API...');
    await login();
    console.log('   ✅ Logged in');

    // Recreate tables
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  STEP 1: RECREATE TABLES                      ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    await recreateTable(DivisionSync, 'divisions_sync');
    await recreateTable(SectionSync, 'sections_sync');
    await recreateTable(EmployeeSync, 'employees_sync');

    // Sync data in order
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            STEP 2: SYNC DATA IN ASCENDING ORDER               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const results = {
      divisions: await syncDivisionsOrdered(),
      sections: await syncSectionsOrdered(),
      employees: await syncEmployeesOrdered()
    };

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SYNC COMPLETE                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n📊 Summary:');
    console.log(`   Divisions:  ${results.divisions.inserted} inserted (IDs: 1-${results.divisions.inserted})`);
    console.log(`   Sections:   ${results.sections.inserted} inserted (IDs: 1-${results.sections.inserted})`);
    console.log(`   Employees:  ${results.employees.inserted} inserted (IDs: 1-${results.employees.inserted})`);

    console.log('\n✅ All data now stored in ASCENDING ORDER by primary key');
    console.log('   This optimizes InnoDB clustered index for faster reads!\n');

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed\n');
  }
}

main();
