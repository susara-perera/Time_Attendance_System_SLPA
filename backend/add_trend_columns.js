/**
 * Migration script to add monthly and annual trend columns to total_count_dashboard
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { sequelize } = require('./config/mysql');

const addTrendColumns = async () => {
  try {
    console.log('📊 Adding trend columns to total_count_dashboard...');

    // Add monthly_trend_data column if it doesn't exist
    await sequelize.query(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS monthly_trend_data JSON 
      COMMENT 'Last 4 weeks attendance trend [week1, week2, week3, week4]'
    `);
    console.log('✅ Added monthly_trend_data column');

    // Add annual_trend_data column if it doesn't exist
    await sequelize.query(`
      ALTER TABLE total_count_dashboard 
      ADD COLUMN IF NOT EXISTS annual_trend_data JSON 
      COMMENT 'Last 12 months attendance trend [jan, feb, ..., dec]'
    `);
    console.log('✅ Added annual_trend_data column');

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

addTrendColumns();
