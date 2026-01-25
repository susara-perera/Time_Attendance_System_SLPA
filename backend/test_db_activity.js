const mysql = require('mysql2/promise');
const moment = require('moment');

async function testActivityLogging() {
  let conn;
  try {
    // Create MySQL connection
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db',
      connectTimeout: 5000,
    });

    console.log('✅ Connected to MySQL database');

    // Insert a test activity
    const testActivity = {
      title: 'Test Activity',
      description: 'Testing activity logging functionality',
      activity_type: 'test_activity',
      icon: 'bi bi-check-circle',
      entity_id: 'test123',
      entity_name: 'Test Entity',
      user_id: 'test_user_123',
      user_name: 'Test User',
      activity_date: moment().format('YYYY-MM-DD'),
      activity_time: moment().format('HH:mm:ss')
    };

    const [result] = await conn.query(
      'INSERT INTO recent_activities (title, description, activity_type, icon, entity_id, entity_name, user_id, user_name, activity_date, activity_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        testActivity.title,
        testActivity.description,
        testActivity.activity_type,
        testActivity.icon,
        testActivity.entity_id,
        testActivity.entity_name,
        testActivity.user_id,
        testActivity.user_name,
        testActivity.activity_date,
        testActivity.activity_time
      ]
    );

    console.log('✅ Test activity inserted with ID:', result.insertId);

    // Verify the activity was inserted
    const [rows] = await conn.query('SELECT * FROM recent_activities WHERE id = ?', [result.insertId]);
    console.log('📋 Inserted activity:', rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (conn) conn.end();
  }
}

testActivityLogging();