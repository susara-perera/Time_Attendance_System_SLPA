const { sequelize } = require('../config/mysql');
const { performFullSync } = require('../services/hrisSyncService');

async function run() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected.');

    console.log('🛠️ Checking/Adding EMP_GENDER column...');
    try {
      await sequelize.query("ALTER TABLE employees_sync ADD COLUMN EMP_GENDER VARCHAR(20) NULL COMMENT 'Gender' AFTER EMP_ADDRESS");
      console.log('✅ Column EMP_GENDER added.');
    } catch (err) {
      if (err.original && err.original.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Column EMP_GENDER already exists.');
      } else {
        console.error('⚠️ Error adding column:', err.message);
      }
    }

    console.log('🔄 Starting Full Sync (this may take a minute)...');
    
    // Trigger sync
    const result = await performFullSync('manual_fix_gender');
    
    console.log('🏁 Sync Finished!');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sequelize.close();
  }
}

run();
