const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, MySQLUser, MySQLDivision, MySQLSection } = require('../models/mysql');

async function run() {
  try {
    console.log('[testUserCreation] Testing user creation flow...\n');
    
    // Step 1: Create test division
    const division = await MySQLDivision.create({
      name: 'Information Systems',
      code: 'IS',
      description: 'IT Department'
    });
    console.log('✅ Created division:', division.name, '(ID:', division.id, ')');
    
    // Step 2: Create test section
    const section = await MySQLSection.create({
      name: 'Information Systems - IS',
      code: 'IS-001',
      divisionId: division.id,
      description: 'IS Section'
    });
    console.log('✅ Created section:', section.name, '(ID:', section.id, ')');
    
    // Step 3: Create test user
    const user = await MySQLUser.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@slpa.lk',
      employeeId: 'EMP001',
      password: 'Test1234!',
      role: 'employee',
      divisionId: division.id,
      sectionId: section.id
    });
    console.log('✅ Created user:', user.firstName, user.lastName, '(ID:', user.id, ')');
    
    // Step 4: Fetch user with associations
    const userWithAssoc = await MySQLUser.findByPk(user.id, {
      include: [
        { model: MySQLDivision, as: 'division', attributes: ['id', 'name', 'code'] },
        { model: MySQLSection, as: 'section', attributes: ['id', 'name', 'code'] }
      ]
    });
    
    console.log('\n✅ User with associations:', JSON.stringify(userWithAssoc, null, 2));
    
    console.log('\n[testUserCreation] ✅ All tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('[testUserCreation] ❌ Error:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

run();
