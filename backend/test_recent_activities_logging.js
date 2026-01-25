/**
 * Test script to verify recent activities logging
 * Run: node test_recent_activities_logging.js
 */

require('dotenv').config();
const { sequelize } = require('./config/mysql');

async function testRecentActivities() {
  try {
    console.log('🔍 Checking recent activities table...\n');
    
    await sequelize.authenticate();
    console.log('✅ MySQL connected\n');

    // Check if table exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'recent_activities'");
    if (tables.length === 0) {
      console.log('❌ recent_activities table does not exist');
      process.exit(1);
    }
    console.log('✅ recent_activities table exists\n');

    // Get count
    const [[countResult]] = await sequelize.query('SELECT COUNT(*) as count FROM recent_activities');
    console.log(`📊 Total activities in table: ${countResult.count}\n`);

    // Get recent 10 activities
    const [activities] = await sequelize.query(`
      SELECT 
        title,
        description,
        activity_type,
        icon,
        user_name,
        activity_date,
        activity_time,
        created_at
      FROM recent_activities 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('📋 Recent 10 activities:');
    console.log('='.repeat(100));
    activities.forEach((activity, index) => {
      console.log(`${index + 1}. [${activity.activity_type}] ${activity.title}`);
      console.log(`   ${activity.description}`);
      console.log(`   By: ${activity.user_name || 'System'} | Date: ${activity.activity_date} ${activity.activity_time}`);
      console.log();
    });

    // Check for specific activity types
    const [activityTypes] = await sequelize.query(`
      SELECT 
        activity_type,
        COUNT(*) as count
      FROM recent_activities 
      GROUP BY activity_type
      ORDER BY count DESC
    `);

    console.log('\n📊 Activity types breakdown:');
    console.log('='.repeat(100));
    activityTypes.forEach(type => {
      console.log(`  ${type.activity_type.padEnd(30)} : ${type.count}`);
    });

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRecentActivities();
