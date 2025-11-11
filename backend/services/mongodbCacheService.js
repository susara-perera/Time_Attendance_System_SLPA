const SubSection = require('../models/SubSection');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Meal = require('../models/Meal');

// Cache configuration
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache TTL
const cache = {
  data: {},
  timestamps: {},
  isInitialized: false
};

// Cache keys
const CACHE_KEYS = {
  SUB_SECTIONS: 'subSections',
  USERS: 'users',
  ATTENDANCE: 'attendance',
  MEALS: 'meals'
};

const isExpired = (key) => {
  const timestamp = cache.timestamps[key];
  if (!timestamp) return true;
  return Date.now() - timestamp > CACHE_TTL;
};

const setCacheData = (key, data) => {
  cache.data[key] = data;
  cache.timestamps[key] = Date.now();
  console.log(`📦 MongoDB cache updated: ${key} (${Array.isArray(data) ? data.length : 'N/A'} items)`);
};

const getCacheData = (key) => {
  if (isExpired(key)) {
    delete cache.data[key];
    delete cache.timestamps[key];
    return null;
  }
  return cache.data[key];
};

// Initialize MongoDB cache
const initializeCache = async () => {
  try {
    console.log('🔄 Initializing MongoDB data cache...');
    
    // Fetch all collections in parallel
    const [subSections, users, attendance, meals] = await Promise.all([
      SubSection.find({}).lean(),
      User.find({}).lean(),
      Attendance.countDocuments({}), // Just count for performance
      // Meal.countDocuments({}) // Uncomment if Meal model exists
    ]);

    // Set cache data
    setCacheData(CACHE_KEYS.SUB_SECTIONS, subSections);
    setCacheData(CACHE_KEYS.USERS, users);
    setCacheData(CACHE_KEYS.ATTENDANCE, attendance);
    // setCacheData(CACHE_KEYS.MEALS, meals);

    cache.isInitialized = true;
    
    console.log('✅ MongoDB cache initialized successfully');
    console.log(`  - Sub Sections: ${subSections.length}`);
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Attendance Records: ${attendance}`);
    // console.log(`  - Meal Records: ${meals}`);
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB cache initialization failed:', error);
    cache.isInitialized = false;
    return false;
  }
};

// Get cached sub sections
const getCachedSubSections = () => {
  return getCacheData(CACHE_KEYS.SUB_SECTIONS);
};

// Get cached users
const getCachedUsers = () => {
  return getCacheData(CACHE_KEYS.USERS);
};

// Get cached attendance count
const getCachedAttendanceCount = () => {
  return getCacheData(CACHE_KEYS.ATTENDANCE);
};

// Get cached meals count
const getCachedMealsCount = () => {
  return getCacheData(CACHE_KEYS.MEALS);
};

// Refresh specific cache
const refreshSubSectionsCache = async () => {
  try {
    console.log('🔄 Refreshing sub sections cache...');
    const subSections = await SubSection.find({}).lean();
    setCacheData(CACHE_KEYS.SUB_SECTIONS, subSections);
    return subSections;
  } catch (error) {
    console.error('❌ Failed to refresh sub sections cache:', error);
    return null;
  }
};

const refreshUsersCache = async () => {
  try {
    console.log('🔄 Refreshing users cache...');
    const users = await User.find({}).lean();
    setCacheData(CACHE_KEYS.USERS, users);
    return users;
  } catch (error) {
    console.error('❌ Failed to refresh users cache:', error);
    return null;
  }
};

// Refresh all cache
const refreshCache = async () => {
  try {
    console.log('🔄 Refreshing MongoDB cache...');
    await initializeCache();
    return true;
  } catch (error) {
    console.error('❌ Failed to refresh MongoDB cache:', error);
    return false;
  }
};

// Clear cache
const clearCache = () => {
  console.log('🗑️ Clearing MongoDB cache...');
  cache.data = {};
  cache.timestamps = {};
  cache.isInitialized = false;
};

// Check if cache is initialized
const isCacheInitialized = () => {
  return cache.isInitialized;
};

// Get cache status
const getCacheStatus = () => {
  const subSections = getCachedSubSections();
  const users = getCachedUsers();
  const attendanceCount = getCachedAttendanceCount();
  const mealsCount = getCachedMealsCount();

  return {
    isInitialized: cache.isInitialized,
    subSectionsCount: subSections ? subSections.length : 0,
    usersCount: users ? users.length : 0,
    attendanceCount: attendanceCount || 0,
    mealsCount: mealsCount || 0,
    hasSubSections: !!subSections,
    hasUsers: !!users,
    timestamps: cache.timestamps
  };
};

module.exports = {
  initializeCache,
  refreshCache,
  clearCache,
  isCacheInitialized,
  getCacheStatus,
  getCachedSubSections,
  getCachedUsers,
  getCachedAttendanceCount,
  getCachedMealsCount,
  refreshSubSectionsCache,
  refreshUsersCache
};