/**
 * Verify Sync Tables Data Order
 * 
 * This script verifies that data in sync tables is stored in ascending order
 * by checking if AUTO_INCREMENT IDs are sequential and aligned with sorted keys
 */

require('dotenv').config();
const { sequelize } = require('../models/mysql');

async function verifySyncOrder() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🔍 VERIFY SYNC TABLES DATA ORDER                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected\n');

    // Check divisions_sync
    console.log('📊 Checking divisions_sync...');
    const [divisions] = await sequelize.query(`
      SELECT id, HIE_CODE, HIE_NAME 
      FROM divisions_sync 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log('   First 10 records (ordered by AUTO_INCREMENT id):');
    divisions.forEach((div, idx) => {
      console.log(`   ${idx + 1}. ID=${div.id} | HIE_CODE=${div.HIE_CODE} | ${div.HIE_NAME}`);
    });

    // Check if HIE_CODE is in ascending order
    const [divOrderCheck] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id = expected_id THEN 1 END) as ordered_correctly
      FROM (
        SELECT 
          id,
          HIE_CODE,
          ROW_NUMBER() OVER (ORDER BY CAST(HIE_CODE AS UNSIGNED)) as expected_id
        FROM divisions_sync
      ) t
    `);
    
    const divPerfect = divOrderCheck[0].ordered_correctly === divOrderCheck[0].total;
    console.log(`   ${divPerfect ? '✅' : '⚠️'}  Order check: ${divOrderCheck[0].ordered_correctly}/${divOrderCheck[0].total} records in perfect ascending order by HIE_CODE\n`);

    // Check sections_sync
    console.log('📊 Checking sections_sync...');
    const [sections] = await sequelize.query(`
      SELECT id, HIE_CODE, HIE_NAME_4 
      FROM sections_sync 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log('   First 10 records (ordered by AUTO_INCREMENT id):');
    sections.forEach((sec, idx) => {
      console.log(`   ${idx + 1}. ID=${sec.id} | HIE_CODE=${sec.HIE_CODE} | ${sec.HIE_NAME_4}`);
    });

    const [secOrderCheck] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id = expected_id THEN 1 END) as ordered_correctly
      FROM (
        SELECT 
          id,
          HIE_CODE,
          ROW_NUMBER() OVER (ORDER BY CAST(HIE_CODE AS UNSIGNED)) as expected_id
        FROM sections_sync
      ) t
    `);
    
    const secPerfect = secOrderCheck[0].ordered_correctly === secOrderCheck[0].total;
    console.log(`   ${secPerfect ? '✅' : '⚠️'}  Order check: ${secOrderCheck[0].ordered_correctly}/${secOrderCheck[0].total} records in perfect ascending order by HIE_CODE\n`);

    // Check employees_sync
    console.log('📊 Checking employees_sync...');
    const [employees] = await sequelize.query(`
      SELECT id, EMP_NO, EMP_NAME 
      FROM employees_sync 
      ORDER BY id 
      LIMIT 10
    `);
    
    console.log('   First 10 records (ordered by AUTO_INCREMENT id):');
    employees.forEach((emp, idx) => {
      console.log(`   ${idx + 1}. ID=${emp.id} | EMP_NO=${emp.EMP_NO} | ${emp.EMP_NAME}`);
    });

    const [empOrderCheck] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id_order = emp_order THEN 1 END) as ordered_correctly
      FROM (
        SELECT 
          id,
          EMP_NO,
          ROW_NUMBER() OVER (ORDER BY id) as id_order,
          ROW_NUMBER() OVER (ORDER BY EMP_NO) as emp_order
        FROM employees_sync
      ) t
    `);
    
    const empPerfect = empOrderCheck[0].ordered_correctly === empOrderCheck[0].total;
    console.log(`   ${empPerfect ? '✅' : '⚠️'}  Order check: ${empOrderCheck[0].ordered_correctly}/${empOrderCheck[0].total} records in perfect ascending order by EMP_NO\n`);

    // Check AUTO_INCREMENT gaps
    console.log('🔍 Checking for AUTO_INCREMENT gaps...\n');

    const [divGaps] = await sequelize.query(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total_records,
        MAX(id) - MIN(id) + 1 - COUNT(*) as gaps
      FROM divisions_sync
    `);
    console.log(`   divisions_sync: ${divGaps[0].gaps === 0 ? '✅' : '⚠️'}  ${divGaps[0].gaps} gaps (IDs: ${divGaps[0].min_id} to ${divGaps[0].max_id})`);

    const [secGaps] = await sequelize.query(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total_records,
        MAX(id) - MIN(id) + 1 - COUNT(*) as gaps
      FROM sections_sync
    `);
    console.log(`   sections_sync:  ${secGaps[0].gaps === 0 ? '✅' : '⚠️'}  ${secGaps[0].gaps} gaps (IDs: ${secGaps[0].min_id} to ${secGaps[0].max_id})`);

    const [empGaps] = await sequelize.query(`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id,
        COUNT(*) as total_records,
        MAX(id) - MIN(id) + 1 - COUNT(*) as gaps
      FROM employees_sync
    `);
    console.log(`   employees_sync: ${empGaps[0].gaps === 0 ? '✅' : '⚠️'}  ${empGaps[0].gaps} gaps (IDs: ${empGaps[0].min_id} to ${empGaps[0].max_id})\n`);

    // Final verdict
    console.log('╔══════════════════════════════════════════════════════════════╗');
    if (divPerfect && secPerfect && empPerfect && 
        divGaps[0].gaps === 0 && secGaps[0].gaps === 0 && empGaps[0].gaps === 0) {
      console.log('║  ✅ ALL TABLES IN PERFECT ASCENDING ORDER - OPTIMIZED!       ║');
    } else {
      console.log('║  ⚠️  SOME TABLES NEED REORDERING                             ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

verifySyncOrder();
