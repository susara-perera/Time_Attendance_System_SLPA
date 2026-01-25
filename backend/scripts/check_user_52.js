require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function checkUserData() {
  try {
    console.log('Checking user ID 52 data in database...\n');
    
    const [users] = await sequelize.query(`
      SELECT 
        id,
        firstName,
        lastName,
        email,
        employeeId,
        role,
        divisionId,
        divisionCode,
        divisionName,
        sectionId,
        sectionCode,
        sectionName,
        subsectionId,
        subsectionCode,
        subsectionName,
        isActive
      FROM users
      WHERE id = 52
    `);
    
    if (users.length === 0) {
      console.log('❌ User with ID 52 not found');
      process.exit(1);
    }
    
    const user = users[0];
    
    console.log('👤 User Details:');
    console.log('  ID:', user.id);
    console.log('  Name:', `${user.firstName} ${user.lastName}`);
    console.log('  Email:', user.email);
    console.log('  Employee ID:', user.employeeId);
    console.log('  Role:', user.role);
    console.log('  Active:', user.isActive);
    
    console.log('\n📊 Division Data:');
    console.log('  divisionId:', user.divisionId, '(type:', typeof user.divisionId, ')');
    console.log('  divisionCode:', user.divisionCode, '(type:', typeof user.divisionCode, ')');
    console.log('  divisionName:', user.divisionName, '(type:', typeof user.divisionName, ')');
    
    console.log('\n📊 Section Data:');
    console.log('  sectionId:', user.sectionId, '(type:', typeof user.sectionId, ')');
    console.log('  sectionCode:', user.sectionCode, '(type:', typeof user.sectionCode, ')');
    console.log('  sectionName:', user.sectionName, '(type:', typeof user.sectionName, ')');
    
    console.log('\n📊 Subsection Data:');
    console.log('  subsectionId:', user.subsectionId);
    console.log('  subsectionCode:', user.subsectionCode);
    console.log('  subsectionName:', user.subsectionName);
    
    // Check if data matches what was sent
    console.log('\n✅ Verification:');
    if (user.divisionId === 'mysql_div_66') {
      console.log('  ✓ divisionId matches (mysql_div_66)');
    } else {
      console.log('  ✗ divisionId mismatch! Expected: mysql_div_66, Got:', user.divisionId);
    }
    
    if (user.divisionCode === '66') {
      console.log('  ✓ divisionCode matches (66)');
    } else {
      console.log('  ✗ divisionCode mismatch! Expected: 66, Got:', user.divisionCode);
    }
    
    if (user.divisionName === 'Information Systems') {
      console.log('  ✓ divisionName matches (Information Systems)');
    } else {
      console.log('  ✗ divisionName mismatch! Expected: Information Systems, Got:', user.divisionName);
    }
    
    if (user.sectionId === 'mysql_sec_326') {
      console.log('  ✓ sectionId matches (mysql_sec_326)');
    } else {
      console.log('  ✗ sectionId mismatch! Expected: mysql_sec_326, Got:', user.sectionId);
    }
    
    if (user.sectionCode === '326') {
      console.log('  ✓ sectionCode matches (326)');
    } else {
      console.log('  ✗ sectionCode mismatch! Expected: 326, Got:', user.sectionCode);
    }
    
    if (user.sectionName === 'Administration  - (IS)') {
      console.log('  ✓ sectionName matches (Administration  - (IS))');
    } else {
      console.log('  ✗ sectionName mismatch! Expected: Administration  - (IS), Got:', user.sectionName);
    }
    
    // Summary
    console.log('\n📋 Summary:');
    const hasDivision = user.divisionId && user.divisionName;
    const hasSection = user.sectionId && user.sectionName;
    
    if (hasDivision && hasSection) {
      console.log('✅ Division and Section data stored correctly!');
    } else if (hasDivision && !hasSection) {
      console.log('⚠️  Division stored, but Section is missing');
    } else if (!hasDivision && hasSection) {
      console.log('⚠️  Section stored, but Division is missing');
    } else {
      console.log('❌ Both Division and Section data are missing!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUserData();
