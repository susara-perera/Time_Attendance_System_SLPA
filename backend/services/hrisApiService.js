const axios = require('axios');

const API_URL = 'http://hris.slpa.lk:8082/api/v1';
const LOGIN_URL = `${API_URL}/auth/login`;
const READ_DATA_URL = `${API_URL}/general-queries/readData`;

// Hardcoded HRIS credentials
const HRIS_USERNAME = 'is_division';
const HRIS_PASSWORD = 'Is@division_2026';

let token = null;
let tokenExpiresAt = null;

// Cache configuration
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL
const cache = {
  data: {},
  timestamps: {},
  isInitialized: false
};

const login = async () => {
  try {
    console.log('🔐 Logging into HRIS API...');
    const response = await axios.post(LOGIN_URL, {
      username: HRIS_USERNAME,
      password: HRIS_PASSWORD
    });

    if (response.data) {
      // Check if response has token directly or nested in data
      const responseToken = response.data.token || response.data.data?.token;
      
      if (responseToken) {
        console.log('✅ HRIS API login successful');
        token = responseToken;
        
        // Decode token to get expiration, assuming it's a standard JWT
        try {
          const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          if (decodedToken.exp) {
            tokenExpiresAt = new Date(decodedToken.exp * 1000);
            console.log(`🕐 Token expires at: ${tokenExpiresAt}`);
          }
        } catch (tokenDecodeError) {
          console.warn('⚠️ Could not decode token expiration:', tokenDecodeError.message);
          // Set a default expiration of 1 hour
          tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        }
        return token;
      } else {
        console.error('❌ HRIS API login failed: No token found in response');
        throw new Error('HRIS API login failed');
      }
    } else {
      console.error('❌ HRIS API login failed: No response data');
      throw new Error('HRIS API login failed');
    }
  } catch (error) {
    console.error('❌ Error logging into HRIS API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

const getToken = async () => {
  if (!token || (tokenExpiresAt && new Date() >= tokenExpiresAt)) {
    console.log('Token is missing or expired, logging in again.');
    return await login();
  }
  return token;
};

const readData = async (collection, filter_array = {}, project = '', paginate = false) => {
  try {
    const authToken = await getToken();
    console.log(`[HRIS readData] Calling ${collection} with filter:`, JSON.stringify(filter_array));
    
    const response = await axios.post(
      READ_DATA_URL,
      {
        collection,
        filter_array: JSON.stringify(filter_array),
        project,
        paginate
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[HRIS readData] Response status: ${response.status}`);
    console.log(`[HRIS readData] Response data structure:`, {
      hasData: !!response.data,
      hasDataField: !!(response.data && response.data.data),
      dataType: response.data ? typeof response.data.data : 'N/A',
      isArray: response.data && response.data.data ? Array.isArray(response.data.data) : false,
      length: response.data && response.data.data && Array.isArray(response.data.data) ? response.data.data.length : 0
    });

    if (response.data && response.data.data) {
      return response.data.data;
    } else {
      console.warn(`⚠️ No data received from HRIS API for collection: ${collection}`);
      console.warn(`[HRIS readData] No data received from HRIS API for collection: ${collection}`);
      console.warn(`[HRIS readData] Full response:`, JSON.stringify(response.data, null, 2));
      return [];
    }
  } catch (error) {
    console.error(`❌ Error fetching data from HRIS API for collection ${collection}:`, error.response ? error.response.data : error.message);
    // If token is invalid, try to login again once
    if (error.response && error.response.status === 401) {
        console.log('🔄 Token might be invalid, forcing re-login...');
        token = null; // Force re-login
        return readData(collection, filter_array, project, paginate);
    }
    throw error;
  }
};

// Check if cache is valid for a given key
const isCacheValid = (key) => {
  if (!cache.timestamps[key]) return false;
  const age = Date.now() - cache.timestamps[key];
  return age < CACHE_TTL;
};

// Get cached data if available and valid
const getCachedData = (key) => {
  if (isCacheValid(key)) {
    console.log(`📦 Using cached data for: ${key}`);
    return cache.data[key];
  }
  return null;
};

// Set cache data
const setCacheData = (key, data) => {
  cache.data[key] = data;
  cache.timestamps[key] = Date.now();
  console.log(`💾 Cached data for: ${key} (TTL: ${CACHE_TTL / 1000}s)`);
};

// Clear specific cache or all cache
const clearCache = (key = null) => {
  if (key) {
    delete cache.data[key];
    delete cache.timestamps[key];
    console.log(`🗑️ Cleared cache for: ${key}`);
  } else {
    cache.data = {};
    cache.timestamps = {};
    console.log('🗑️ Cleared all cache');
  }
};

// Initialize HRIS data cache - called once at server startup or user login
const initializeCache = async () => {
  try {
    console.log('🚀 Initializing HRIS data cache...');
    
    // Login to HRIS
    await login();
    
    // Fetch all critical data at once
    console.log('📥 Fetching company hierarchy...');
    const hierarchy = await readData('company_hierarchy', {});
    setCacheData('company_hierarchy', hierarchy);
    
    // Extract divisions (Level 3) and sections (Level 4)
    const divisions = hierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
    const sections = hierarchy.filter(item => item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4');
    
    setCacheData('divisions', divisions);
    setCacheData('sections', sections);
    
    console.log('📥 Fetching employees...');
    const employees = await readData('employee', {});
    setCacheData('employees', employees);
    
    cache.isInitialized = true;
    console.log(`✅ HRIS cache initialized successfully`);
    console.log(`   - Hierarchy items: ${hierarchy.length}`);
    console.log(`   - Divisions: ${divisions.length}`);
    console.log(`   - Sections: ${sections.length}`);
    console.log(`   - Employees: ${employees.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize HRIS cache:', error.message);
    cache.isInitialized = false;
    return false;
  }
};

// Get cached or fetch data with smart caching
const getCachedOrFetch = async (collection, filter_array = {}, project = '', paginate = false) => {
  // Generate cache key based on collection and filters
  const cacheKey = `${collection}_${JSON.stringify(filter_array)}`;
  
  // Check if we have valid cached data
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  // Fetch fresh data
  console.log(`🔄 Fetching fresh data for: ${collection}`);
  const data = await readData(collection, filter_array, project, paginate);
  
  // Cache the result
  setCacheData(cacheKey, data);
  
  return data;
};

// Get divisions from cache
const getCachedDivisions = () => {
  const cached = getCachedData('divisions');
  if (cached) return cached;
  
  // Fallback to hierarchy if divisions not cached separately
  const hierarchy = getCachedData('company_hierarchy');
  if (hierarchy) {
    const divisions = hierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
    setCacheData('divisions', divisions);
    return divisions;
  }
  
  return null;
};

// Get sections from cache
const getCachedSections = () => {
  const cached = getCachedData('sections');
  if (cached) return cached;
  
  // Fallback to hierarchy if sections not cached separately
  const hierarchy = getCachedData('company_hierarchy');
  if (hierarchy) {
    const sections = hierarchy.filter(item => item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4');
    setCacheData('sections', sections);
    return sections;
  }
  
  return null;
};

// Get employees from cache
const getCachedEmployees = () => {
  return getCachedData('employees');
};

// Refresh cache manually
const refreshCache = async () => {
  console.log('🔄 Manually refreshing HRIS cache...');
  clearCache();
  return await initializeCache();
};

module.exports = {
  login,
  readData,
  initializeCache,
  refreshCache,
  clearCache,
  getCachedOrFetch,
  getCachedDivisions,
  getCachedSections,
  getCachedEmployees,
  isCacheInitialized: () => cache.isInitialized
};
