require('dotenv').config();
const moment = require('moment');
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');

// Import models
const SubSection = require('./models/SubSection');
const TransferToSubsection = require('./models/TransferToSubsection');
const { RecentActivity } = require('./models/mysql');

async function migrateRecentActivities() {
  try {
    console.log('🚀 Starting recent activities migration...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slpa_db');
    console.log('✅ Connected to MongoDB');

    // Connect to MySQL
    const mysqlConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db'
    });
    console.log('✅ Connected to MySQL');

    // Get recent data from MongoDB (last 90 days or all if no recent data)
    const ninetyDaysAgo = moment().subtract(90, 'days').toDate();

    console.log('📊 Fetching data from MongoDB...');
    const [recentSubSections, recentTransfers] = await Promise.all([
      SubSection.find({ createdAt: { $gte: ninetyDaysAgo } }).sort({ createdAt: -1 }).lean(),
      TransferToSubsection.find({ transferredAt: { $gte: ninetyDaysAgo } }).sort({ transferredAt: -1 }).lean()
    ]);

    console.log(`📈 Found ${recentSubSections.length} sub-sections and ${recentTransfers.length} transfers in last 90 days`);

    // If no recent data, try to get some older data for testing
    if (recentSubSections.length === 0 && recentTransfers.length === 0) {
      console.log('⚠️ No recent data found. Fetching some older records for testing...');
      const [allSubSections, allTransfers] = await Promise.all([
        SubSection.find({}).sort({ createdAt: -1 }).limit(10).lean(),
        TransferToSubsection.find({}).sort({ transferredAt: -1 }).limit(10).lean()
      ]);

      console.log(`📈 Found ${allSubSections.length} total sub-sections and ${allTransfers.length} total transfers`);
      recentSubSections.push(...allSubSections);
      recentTransfers.push(...allTransfers);
    }

    // Prepare activities for insertion
    const activities = [];

    // Convert sub-section creations
    recentSubSections.forEach(sub => {
      activities.push({
        title: 'New Sub-Section',
        description: `"${sub.subSection?.sub_hie_name || 'Unknown'}" added`,
        activity_type: 'subsection_created',
        icon: 'bi bi-diagram-2',
        entity_id: sub._id?.toString(),
        entity_name: sub.subSection?.sub_hie_name || 'Unknown',
        activity_date: moment(sub.createdAt).format('YYYY-MM-DD'),
        activity_time: moment(sub.createdAt).format('HH:mm:ss'),
        created_at: sub.createdAt
      });
    });

    // Convert employee transfers
    recentTransfers.forEach(tr => {
      activities.push({
        title: 'Employee Transferred',
        description: `"${tr.employeeName}" transferred to "${tr.sub_hie_name}"`,
        activity_type: 'employee_transferred',
        icon: 'bi bi-arrow-left-right',
        entity_id: tr.employeeId,
        entity_name: tr.employeeName,
        activity_date: moment(tr.transferredAt).format('YYYY-MM-DD'),
        activity_time: moment(tr.transferredAt).format('HH:mm:ss'),
        created_at: tr.transferredAt
      });
    });

    // If still no data, create some sample activities for testing
    if (recentSubSections.length === 0 && recentTransfers.length === 0) {
      console.log('⚠️ No data found in MongoDB. Creating sample activities for testing...');

      const now = moment();
      activities.push({
        title: 'System Started',
        description: 'Dashboard system initialized successfully',
        activity_type: 'system_startup',
        icon: 'bi bi-power',
        entity_id: 'system',
        entity_name: 'SLPA Dashboard',
        activity_date: now.format('YYYY-MM-DD'),
        activity_time: now.format('HH:mm:ss'),
        created_at: now.toDate()
      });

      activities.push({
        title: 'Database Connected',
        description: 'MySQL database connection established',
        activity_type: 'database_connected',
        icon: 'bi bi-database',
        entity_id: 'mysql',
        entity_name: 'MySQL Database',
        activity_date: now.subtract(5, 'minutes').format('YYYY-MM-DD'),
        activity_time: now.subtract(5, 'minutes').format('HH:mm:ss'),
        created_at: now.subtract(5, 'minutes').toDate()
      });
    }

    console.log(`📝 Prepared ${activities.length} activities for insertion`);

    // Insert into MySQL table
    if (activities.length > 0) {
      const insertQuery = `
        INSERT INTO recent_activities
        (title, description, activity_type, icon, entity_id, entity_name, activity_date, activity_time, created_at)
        VALUES ?
      `;

      const values = activities.map(activity => [
        activity.title,
        activity.description,
        activity.activity_type,
        activity.icon,
        activity.entity_id,
        activity.entity_name,
        activity.activity_date,
        activity.activity_time,
        activity.created_at
      ]);

      const [result] = await mysqlConnection.query(insertQuery, [values]);
      console.log(`✅ Successfully inserted ${result.affectedRows} activities into MySQL`);
    }

    // Verify the data
    const [countResult] = await mysqlConnection.query('SELECT COUNT(*) as count FROM recent_activities');
    console.log(`📊 Total activities in MySQL table: ${countResult[0].count}`);

    // Show sample data
    const [sample] = await mysqlConnection.query('SELECT * FROM recent_activities ORDER BY created_at DESC LIMIT 5');
    console.log('\n📋 Sample migrated activities:');
    sample.forEach(activity => {
      console.log(`  ${activity.activity_date} ${activity.activity_time} - ${activity.title}: ${activity.description}`);
    });

    await mysqlConnection.end();
    await mongoose.disconnect();

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrateRecentActivities();