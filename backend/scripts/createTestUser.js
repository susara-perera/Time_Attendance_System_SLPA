const path = require('path');

// Ensure we have correct CWD
process.chdir(path.resolve(__dirname, '..'));

// Load environment variables from .env in backend
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, MySQLUser, MySQLRole } = require('../models/mysql');

(async () => {
  try {
    console.log('[createTestUser] Authenticating DB connection...');
    await sequelize.authenticate();
    console.log('[createTestUser] DB connection OK');

    // Ensure role exists
    const roleValue = 'employee';
    let role = await MySQLRole.findOne({ where: { value: roleValue } });
    if (!role) {
      console.log(`[createTestUser] Role '${roleValue}' not found, creating it`);
      role = await MySQLRole.create({
        value: roleValue,
        label: 'Employee',
        name: 'Employee',
        description: 'Auto-created employee role for tests'
      });
      console.log('[createTestUser] Role created:', role.value);
    } else {
      console.log('[createTestUser] Role exists:', role.value);
    }

    // Create test user (idempotent)
    const userEmail = 'test.user@example.com';
    const employeeId = 'testuser1';

    const [user, created] = await MySQLUser.findOrCreate({
      where: { email: userEmail },
      defaults: {
        firstName: 'Test',
        lastName: 'User',
        email: userEmail,
        employeeId: employeeId,
        password: 'Test1234!',
        role: roleValue,
        phone: null,
        address: null
      }
    });

    console.log('[createTestUser] User result - created:', created);
    console.log('[createTestUser] User record:', user.toJSON());

    process.exit(0);
  } catch (err) {
    console.error('[createTestUser] Error:', err);
    process.exit(1);
  }
})();