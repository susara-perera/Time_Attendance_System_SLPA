/**
 * HRIS Sync Controller
 * 
 * Handles manual sync triggers and sync status monitoring
 */

const { Op } = require('sequelize');

const {
  syncDivisions,
  syncSections,
  syncEmployees,
  performFullSync,
  getSyncStatus
} = require('../services/hrisSyncService');

const { syncEmpIndex } = require('../services/empIndexSyncService');
const { syncSubSections } = require('../services/subSectionSyncService');
const { syncAttendance } = require('../services/attendanceSyncService');

const {
  getSchedulerStatus,
  triggerManualSync,
  updateSchedule,
  getCronDescription
} = require('../services/hrisSyncScheduler');

const { DivisionSync, SectionSync, EmployeeSync } = require('../models/mysql');

/**
 * @desc    Get sync status and statistics
 * @route   GET /api/sync/status
 * @access  Private (super_admin, admin)
 */
const getSyncStatusHandler = async (req, res) => {
  try {
    const status = await getSchedulerStatus();

    res.status(200).json({
      success: true,
      data: status,
      message: 'Sync status retrieved successfully'
    });

  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sync status',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger manual full sync
 * @route   POST /api/sync/trigger/full
 * @access  Private (super_admin only)
 */
const triggerFullSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    console.log(`🔧 Manual full sync triggered by user: ${triggeredBy}`);

    // Run sync asynchronously and return immediately
    const syncPromise = triggerManualSync(triggeredBy);

    res.status(202).json({
      success: true,
      message: 'Full sync triggered successfully. This may take several minutes.',
      data: {
        triggeredBy,
        triggeredAt: new Date(),
        note: 'Check /api/sync/status for progress'
      }
    });

    // Wait for sync to complete (runs in background)
    const result = await syncPromise;
    console.log('✅ Manual full sync completed:', result);

  } catch (error) {
    console.error('Trigger full sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger sync',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger divisions sync only
 * @route   POST /api/sync/trigger/divisions
 * @access  Private (super_admin, admin)
 */
const triggerDivisionsSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    const result = await syncDivisions(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Divisions sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger divisions sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync divisions',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger sections sync only
 * @route   POST /api/sync/trigger/sections
 * @access  Private (super_admin, admin)
 */
const triggerSectionsSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    const result = await syncSections(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Sections sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger sections sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync sections',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger employees sync only
 * @route   POST /api/sync/trigger/employees
 * @access  Private (super_admin, admin)
 */
const triggerEmployeesSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    const result = await syncEmployees(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Employees sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger employees sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync employees',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger emp_index_list sync only
 * @route   POST /api/sync/trigger/emp-index
 * @access  Private (super_admin, admin)
 */
const triggerEmpIndexSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    const result = await syncEmpIndex(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Employee index sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger emp index sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync employee index',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger sub_sections sync only
 * @route   POST /api/sync/trigger/subsections
 * @access  Private (super_admin, admin)
 */
const triggerSubSectionsSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    
    const result = await syncSubSections(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Sub-sections sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger sub-sections sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync sub-sections',
      error: error.message
    });
  }
};

/**
 * @desc    Trigger attendance sync only
 * @route   POST /api/sync/trigger/attendance
 * @access  Private (super_admin, admin)
 */
const triggerAttendanceSync = async (req, res) => {
  try {
    const triggeredBy = req.user?.id || req.user?._id || 'manual';
    const { startDate, endDate } = req.body;
    
    const result = await syncAttendance(startDate, endDate, triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Attendance sync completed',
      data: result
    });

  } catch (error) {
    console.error('Trigger attendance sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync attendance',
      error: error.message
    });
  }
};

/**
 * @desc    Get synced divisions from MySQL
 * @route   GET /api/sync/divisions
 * @access  Private
 */
const getSyncedDivisions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search,
      status = 'ACTIVE'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { HIE_NAME: { [Op.like]: `%${search}%` } },
        { HIE_CODE: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status) {
      where.STATUS = status;
    }

    const { count, rows } = await DivisionSync.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['HIE_NAME', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get synced divisions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve divisions',
      error: error.message
    });
  }
};

/**
 * @desc    Get synced sections from MySQL
 * @route   GET /api/sync/sections
 * @access  Private
 */
const getSyncedSections = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search,
      divisionCode,
      status = 'ACTIVE'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { HIE_NAME_4: { [Op.like]: `%${search}%` } },
        { HIE_CODE: { [Op.like]: `%${search}%` } }
      ];
    }

    if (divisionCode) {
      where.HIE_CODE_3 = divisionCode;
    }

    if (status) {
      where.STATUS = status;
    }

    const { count, rows } = await SectionSync.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['HIE_NAME_4', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get synced sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sections',
      error: error.message
    });
  }
};

/**
 * @desc    Get synced employees from MySQL
 * @route   GET /api/sync/employees
 * @access  Private
 */
const getSyncedEmployees = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 100, 
      search,
      divisionCode,
      sectionCode,
      status = 'ACTIVE'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { EMP_NAME: { [Op.like]: `%${search}%` } },
        { EMP_NO: { [Op.like]: `%${search}%` } },
        { EMP_NIC: { [Op.like]: `%${search}%` } }
      ];
    }

    if (divisionCode) {
      where.DIV_CODE = divisionCode;
    }

    if (sectionCode) {
      where.SEC_CODE = sectionCode;
    }

    if (status) {
      where.STATUS = status;
    }

    const { count, rows } = await EmployeeSync.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['EMP_NAME', 'ASC']]
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Get synced employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve employees',
      error: error.message
    });
  }
};

/**
 * @desc    Update sync schedule
 * @route   PUT /api/sync/schedule
 * @access  Private (super_admin only)
 */
const updateSyncSchedule = async (req, res) => {
  try {
    const { cronExpression } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Cron expression is required'
      });
    }

    updateSchedule(cronExpression);

    res.status(200).json({
      success: true,
      message: 'Sync schedule updated successfully',
      data: {
        cronExpression,
        description: getCronDescription(cronExpression)
      }
    });

  } catch (error) {
    console.error('Update sync schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sync schedule',
      error: error.message
    });
  }
};

module.exports = {
  getSyncStatusHandler,
  triggerFullSync,
  triggerDivisionsSync,
  triggerSectionsSync,
  triggerEmployeesSync,
  triggerEmpIndexSync,
  triggerSubSectionsSync,
  triggerAttendanceSync,
  getSyncedDivisions,
  getSyncedSections,
  getSyncedEmployees,
  updateSyncSchedule
};
