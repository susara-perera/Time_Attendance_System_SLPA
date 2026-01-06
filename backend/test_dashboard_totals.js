require('dotenv').config();
require('./config/database');
const { getDashboardTotals } = require('./services/dashboardTotalsService');

(async () => {
  try {
    console.log('🔍 Testing dashboard totals service...\n');
    
    const result = await getDashboardTotals();
    
    console.log('✅ Dashboard totals retrieved successfully:\n');
    console.log(JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
