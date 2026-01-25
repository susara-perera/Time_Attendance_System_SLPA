const mysql = require('mysql2/promise');

async function checkRecentActivities() {
  let conn;
  try {
    // Create MySQL connection using environment variables or defaults
    conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'slpa_db',
      connectTimeout: 5000,
    });

    console.log('✅ Connected to MySQL database');

    // Check if table exists
    const [tables] = await conn.query("SHOW TABLES LIKE 'recent_activities'");
    if (tables.length === 0) {
      console.log('❌ recent_activities table does not exist');
      return;
    }

    // Get count
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM recent_activities');
    console.log('📊 Total activities:', rows[0].count);

    // Get recent activities
    const [recent] = await conn.query('SELECT * FROM recent_activities ORDER BY activity_date DESC, activity_time DESC LIMIT 5');
    console.log('\n📋 Recent activities:');
    recent.forEach(a => {
      console.log(`${a.activity_date} ${a.activity_time}: ${a.title} - ${a.description} (${a.activity_type})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (conn) conn.end();
  }
}

checkRecentActivities();