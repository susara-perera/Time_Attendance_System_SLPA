require('dotenv').config();
const { sequelize, SyncSchedule } = require('./models/mysql');

async function createTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected');
    
    // Create the sync_schedules table
    await SyncSchedule.sync({ force: false });
    console.log('✅ sync_schedules table created/verified');
    
    // Initialize default schedules
    const { initializeDefaults } = require('./controllers/syncScheduleController');
    await initializeDefaults();
    console.log('✅ Default schedules initialized');
    
    // Check data
    const schedules = await SyncSchedule.findAll();
    console.log(`✅ Found ${schedules.length} schedules:`, schedules.map(s => s.task_name));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

createTable();
