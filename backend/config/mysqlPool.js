const mysql = require('mysql2/promise');

/**
 * MySQL Connection Pool Configuration
 * High-performance connection pool for attendance reports and queries
 */

let pool = null;

const poolConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'slpa_db',
  waitForConnections: true,
  connectionLimit: 20, // Max concurrent connections
  maxIdle: 10, // Max idle connections
  idleTimeout: 60000, // 60 seconds
  queueLimit: 0, // Unlimited queue
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000, // 10 seconds
  // Performance optimizations
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
  multipleStatements: false, // Security: prevent SQL injection
  timezone: '+00:00',
};

/**
 * Get or create connection pool
 */
const getPool = () => {
  if (!pool) {
    console.log('🔧 Creating MySQL connection pool...');
    pool = mysql.createPool(poolConfig);
    
    // Pool event handlers
    pool.on('acquire', (connection) => {
      // console.log('🔗 Connection %d acquired', connection.threadId);
    });
    
    pool.on('connection', (connection) => {
      console.log('✅ New connection established (ID: %d)', connection.threadId);
    });
    
    pool.on('enqueue', () => {
      // console.log('⏳ Waiting for available connection slot');
    });
    
    pool.on('release', (connection) => {
      // console.log('🔓 Connection %d released', connection.threadId);
    });
    
    console.log(`✅ MySQL pool created: ${poolConfig.connectionLimit} max connections, ${poolConfig.maxIdle} idle`);
  }
  return pool;
};

/**
 * Execute a query using the connection pool
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
const executeQuery = async (sql, params = []) => {
  const pool = getPool();
  const startTime = Date.now();
  
  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 2000) {
      console.warn(`⚠️ SLOW QUERY (${duration}ms):`, sql.substring(0, 100));
    }
    
    return [rows, duration];
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query failed (${duration}ms):`, error.message);
    throw error;
  }
};

/**
 * Get a connection from the pool for transactions
 * Remember to call connection.release() when done!
 */
const getConnection = async () => {
  const pool = getPool();
  return await pool.getConnection();
};

/**
 * Test pool connection
 */
const testConnection = async () => {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL pool connection test successful');
    return true;
  } catch (error) {
    console.error('❌ MySQL pool connection test failed:', error.message);
    return false;
  }
};

/**
 * Get pool statistics
 */
const getPoolStats = () => {
  if (!pool) return null;
  
  return {
    totalConnections: pool.pool._allConnections.length,
    freeConnections: pool.pool._freeConnections.length,
    queuedRequests: pool.pool._connectionQueue.length,
    limit: poolConfig.connectionLimit
  };
};

/**
 * Close pool gracefully (for shutdown)
 */
const closePool = async () => {
  if (pool) {
    console.log('🔒 Closing MySQL connection pool...');
    await pool.end();
    pool = null;
    console.log('✅ MySQL pool closed');
  }
};

module.exports = {
  getPool,
  executeQuery,
  getConnection,
  testConnection,
  getPoolStats,
  closePool
};
