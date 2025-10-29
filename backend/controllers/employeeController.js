const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Meal = require('../models/Meal');
const Division = require('../models/Division');
const Section = require('../models/Section');

// GET /api/employees
// Query params: divisionId, sectionId, startDate, endDate, type=attendance|meal|both, includeRecords=true|false, page, limit
const getEmployeesWithStats = async (req, res) => {
  try {
    const {
      divisionId,
      sectionId,
      startDate,
      endDate,
      type = 'both',
      includeRecords = 'false',
      page = 1,
      limit = 1000
    } = req.query;

    const includeRecordsBool = includeRecords === 'true';

    // Build user query
    const userQuery = { isActive: true };

    // Support MongoDB ObjectId division/section or HRIS codes
    const isMongoDivisionId = divisionId && divisionId.length === 24 && /^[0-9a-fA-F]{24}$/.test(divisionId);
    if (divisionId) {
      if (isMongoDivisionId) {
        userQuery.division = divisionId;
      } else {
        // try to map by code or name
        const div = await Division.findOne({ $or: [{ code: divisionId }, { name: divisionId }, { hie_code: divisionId }] });
        if (div) userQuery.division = div._id;
        else {
          // no local division found; attempt to match users by division string stored in user.division (rare)
        }
      }
    }

    const isMongoSectionId = sectionId && sectionId.length === 24 && /^[0-9a-fA-F]{24}$/.test(sectionId);
    if (sectionId) {
      if (isMongoSectionId) {
        userQuery.section = sectionId;
      } else {
        const sec = await Section.findOne({ $or: [{ code: sectionId }, { name: sectionId }, { section_id: sectionId }] });
        if (sec) userQuery.section = sec._id;
      }
    }

    // Fetch users (with pagination)
    const skip = (page - 1) * limit;
    const users = await User.find(userQuery)
      .select('-password')
      .populate('division', 'name code')
      .populate('section', 'name code')
      .sort({ firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const userIds = users.map(u => u._id);

    // Build date filter if provided
    const dateMatch = {};
    if (startDate && endDate) {
      dateMatch.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      dateMatch.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateMatch.date = { $lte: new Date(endDate) };
    }

    // Prepare aggregations
    const resultsByUser = {};
    users.forEach(u => {
      resultsByUser[u._id.toString()] = {
        _id: u._id,
        employeeId: u.employeeId,
        name: `${u.firstName} ${u.lastName}`,
        division: u.division || null,
        section: u.section || null,
        attendanceCount: 0,
        mealCount: 0,
        attendanceRecords: [],
        mealRecords: []
      };
    });

    // Attendance counts
    if (type === 'attendance' || type === 'both') {
      const match = { user: { $in: userIds }, ...dateMatch };
      const attendanceAgg = [
        { $match: match },
        { $group: { _id: '$user', count: { $sum: 1 }, records: { $push: '$$ROOT' } } }
      ];

      const attendanceData = await Attendance.aggregate(attendanceAgg).allowDiskUse(true);
      attendanceData.forEach(a => {
        const id = a._id.toString();
        if (resultsByUser[id]) {
          resultsByUser[id].attendanceCount = a.count;
          if (includeRecordsBool) resultsByUser[id].attendanceRecords = a.records;
        }
      });
    }

    // Meal counts
    if (type === 'meal' || type === 'both') {
      const match = { user: { $in: userIds }, ...dateMatch };
      const mealAgg = [
        { $match: match },
        { $group: { _id: '$user', count: { $sum: 1 }, records: { $push: '$$ROOT' } } }
      ];

      const mealData = await Meal.aggregate(mealAgg).allowDiskUse(true);
      mealData.forEach(m => {
        const id = m._id.toString();
        if (resultsByUser[id]) {
          resultsByUser[id].mealCount = m.count;
          if (includeRecordsBool) resultsByUser[id].mealRecords = m.records;
        }
      });
    }

    // Build final array preserving user order
    const employeesOut = users.map(u => ({
      _id: u._id,
      employeeId: u.employeeId,
      name: `${u.firstName} ${u.lastName}`,
      division: u.division,
      section: u.section,
      attendanceCount: resultsByUser[u._id.toString()].attendanceCount || 0,
      mealCount: resultsByUser[u._id.toString()].mealCount || 0,
      ...(includeRecordsBool && { attendanceRecords: resultsByUser[u._id.toString()].attendanceRecords || [], mealRecords: resultsByUser[u._id.toString()].mealRecords || [] })
    }));

    res.status(200).json({ success: true, data: employeesOut, total: employeesOut.length });
  } catch (error) {
    console.error('Get employees with stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching employee data' });
  }
};

module.exports = { getEmployeesWithStats };
