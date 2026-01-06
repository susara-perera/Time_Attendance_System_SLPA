const Section = require('../models/Section');
const User = require('../models/User');
const Division = require('../models/Division');
const AuditLog = require('../models/AuditLog');
const { validationResult } = require('express-validator');
// Note: HRIS cache is no longer used - data comes from MySQL sync tables

// @desc    Get all sections
// @route   GET /api/sections
// @access  Private
const getSections = async (req, res) => {
  try {
    const {
      page = 1,
      limit = req.query.limit ? parseInt(req.query.limit) : 1000, // Increased default limit to 1000
      sort = '-createdAt',
      division,
      status,
      search
    } = req.query;

    // Build filter object
    const filter = {
      status: { $ne: 'deleted' } // Exclude deleted sections by default
    };
    
    if (division) filter.division = division;
    if (status && status !== 'deleted') filter.status = status; // Allow filtering by active/inactive, but not deleted
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get sections with population
    const sections = await Section.find(filter)
      .populate('division', 'name code')
      .populate('employees', 'firstName lastName employeeId')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Section.countDocuments(filter);

    res.json({
      success: true,
      data: sections,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sections'
    });
  }
};

// @desc    Get single section
// @route   GET /api/sections/:id
// @access  Private
const getSection = async (req, res) => {
  try {
    const section = await Section.findOne({ 
      _id: req.params.id, 
      status: { $ne: 'deleted' } 
    })
      .populate('division', 'name code workingHours')
      .populate('employees', 'firstName lastName employeeId email phone')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    res.json({
      success: true,
      data: section
    });
  } catch (error) {
    console.error('Get section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve section'
    });
  }
};

// @desc    Create section
// @route   POST /api/sections
// @access  Private (administrator and super_admin only)
const createSection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      name,
      code,
      description,
      division,
      capacity,
      location,
      workingHours,
      budget,
      status
    } = req.body;

    // Check if division exists
    const divisionExists = await Division.findById(division);
    if (!divisionExists) {
      return res.status(404).json({
        success: false,
        error: 'Division not found'
      });
    }

    // Generate code if not provided
    const sectionCode = code || name.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 10);

    // Check for duplicate section code within division
    const existingSection = await Section.findOne({ 
      code: sectionCode, 
      division,
      status: { $ne: 'deleted' }
    });
    
    if (existingSection) {
      return res.status(400).json({
        success: false,
        error: 'Section code already exists in this division'
      });
    }

    const section = await Section.create({
      name,
      code: sectionCode,
      description,
      division,
      capacity: capacity || 10,
      location,
      workingHours,
      budget,
      status: status || 'active',
      isActive: (status || 'active') === 'active',
      createdBy: req.user.id
    });

    await section.populate('division', 'name code');

    // Log section creation
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'section_created',
        entity: { type: 'Section', id: section._id, name: section.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Section "${section.name}" created`,
        details: `Created section "${section.name}" (${section.code}) under division "${section.division?.name || division}"`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log section creation:', auditErr);
    }

    res.status(201).json({
      success: true,
      data: section,
      message: 'Section created successfully'
    });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create section'
    });
  }
};

// @desc    Update section
// @route   PUT /api/sections/:id
// @access  Private (administrator and super_admin only)
const updateSection = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    const {
      name,
      code,
      description,
      division,
      capacity,
      location,
      workingHours,
      budget,
      status
    } = req.body;

    // If division is being changed, check if it exists
    if (division && division !== section.division.toString()) {
      const divisionExists = await Division.findById(division);
      if (!divisionExists) {
        return res.status(404).json({
          success: false,
          error: 'Division not found'
        });
      }
    }

    // Check for duplicate section code if code is being changed
    if (code && code !== section.code) {
      const existingSection = await Section.findOne({ 
        code,
        division: division || section.division,
        _id: { $ne: req.params.id },
        status: { $ne: 'deleted' }
      });
      
      if (existingSection) {
        return res.status(400).json({
          success: false,
          error: 'Section code already exists in this division'
        });
      }
    }

    // Update section
    const updateData = {
      name,
      code,
      description,
      division,
      capacity,
      location,
      workingHours,
      budget,
      status,
      updatedBy: req.user.id
    };

    // Synchronize isActive with status
    if (status) {
      updateData.isActive = status === 'active';
    }

    const updatedSection = await Section.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('division', 'name code');

    // Log section update
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'section_updated',
        entity: { type: 'Section', id: updatedSection._id, name: updatedSection.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Section "${updatedSection.name}" updated`,
        details: `Updated section "${updatedSection.name}" (${updatedSection.code})`,
        changes: { before: { name: section.name, code: section.code, status: section.status }, after: updateData },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log section update:', auditErr);
    }

    res.json({
      success: true,
      data: updatedSection,
      message: 'Section updated successfully'
    });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update section'
    });
  }
};

// @desc    Delete section
// @route   DELETE /api/sections/:id
// @access  Private (super_admin only)
const deleteSection = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // Check if section has employees
    if (section.employees && section.employees.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete section with assigned employees. Please reassign employees first.'
      });
    }

    // Soft delete
    await Section.findByIdAndUpdate(req.params.id, {
      status: 'deleted',
      isActive: false,
      updatedBy: req.user.id
    });

    // Log section deletion
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'section_deleted',
        entity: { type: 'Section', id: section._id, name: section.name },
        category: 'data_modification',
        severity: 'high',
        description: `Section "${section.name}" deleted`,
        details: `Deleted section "${section.name}" (${section.code})`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log section deletion:', auditErr);
    }

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete section'
    });
  }
};

// @desc    Get section employees
// @route   GET /api/sections/:id/employees
// @access  Private
const getSectionEmployees = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'firstName',
      status,
      search
    } = req.query;

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // Build filter for employees
    const filter = { 
      _id: { $in: section.employees },
      status: { $ne: 'deleted' }
    };
    
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const employees = await User.find(filter)
      .select('firstName lastName employeeId email phone role status joinDate')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: employees,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get section employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve section employees'
    });
  }
};

// @desc    Get section statistics
// @route   GET /api/sections/:id/stats
// @access  Private
const getSectionStats = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate('employees', 'status');

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    const stats = {
      totalEmployees: section.employees.length,
      activeEmployees: section.employees.filter(emp => emp.status === 'active').length,
      capacity: section.capacity,
      utilizationRate: section.capacity > 0 ? 
        ((section.employees.length / section.capacity) * 100).toFixed(2) + '%' : '0%',
      budget: section.budget,
      location: section.location,
      performance: section.performance || {}
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get section stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve section statistics'
    });
  }
};

// @desc    Toggle section status
// @route   PATCH /api/sections/:id/toggle-status
// @access  Private (administrator and super_admin only)
const toggleSectionStatus = async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    const newStatus = section.status === 'active' ? 'inactive' : 'active';
    
    const updatedSection = await Section.findByIdAndUpdate(
      req.params.id,
      { 
        status: newStatus,
        updatedBy: req.user.id
      },
      { new: true }
    ).populate('division', 'name code');

    // Log section status toggle
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: newStatus === 'active' ? 'section_activated' : 'section_deactivated',
        entity: { type: 'Section', id: updatedSection._id, name: updatedSection.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Section "${updatedSection.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
        details: `Changed section status from "${section.status}" to "${newStatus}"`,
        changes: { before: { status: section.status }, after: { status: newStatus } },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log section status toggle:', auditErr);
    }

    res.json({
      success: true,
      data: updatedSection,
      message: `Section ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Toggle section status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle section status'
    });
  }
};

// @desc    Assign employee to section
// @route   POST /api/sections/:id/employees/:employeeId
// @access  Private (administrator and super_admin only)
const assignEmployeeToSection = async (req, res) => {
  try {
    const { id: sectionId, employeeId } = req.params;

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Check if employee is already in this section
    if (section.employees.includes(employeeId)) {
      return res.status(400).json({
        success: false,
        error: 'Employee is already assigned to this section'
      });
    }

    // Check section capacity
    if (section.capacity && section.employees.length >= section.capacity) {
      return res.status(400).json({
        success: false,
        error: 'Section has reached maximum capacity'
      });
    }

    // Add employee to section
    section.employees.push(employeeId);
    await section.save();

    // Update employee's section
    await User.findByIdAndUpdate(employeeId, { section: sectionId });

    // Log employee assignment
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'employee_assigned_to_section',
        entity: { type: 'Section', id: section._id, name: section.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Employee "${employee.firstName} ${employee.lastName}" assigned to section "${section.name}"`,
        details: `Assigned employee ${employee.employeeId} to section ${section.name} (${section.code})`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log employee assignment:', auditErr);
    }

    res.json({
      success: true,
      message: 'Employee assigned to section successfully'
    });
  } catch (error) {
    console.error('Assign employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign employee to section'
    });
  }
};

// @desc    Remove employee from section
// @route   DELETE /api/sections/:id/employees/:employeeId
// @access  Private (administrator and super_admin only)
const removeEmployeeFromSection = async (req, res) => {
  try {
    const { id: sectionId, employeeId } = req.params;

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    // Check if employee is in this section
    if (!section.employees.includes(employeeId)) {
      return res.status(400).json({
        success: false,
        error: 'Employee is not assigned to this section'
      });
    }

    // Remove employee from section
    section.employees = section.employees.filter(id => id.toString() !== employeeId);
    await section.save();

    // Remove section from employee
    await User.findByIdAndUpdate(employeeId, { $unset: { section: 1 } });

    // Log employee removal
    try {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'employee_removed_from_section',
        entity: { type: 'Section', id: section._id, name: section.name },
        category: 'data_modification',
        severity: 'medium',
        description: `Employee "${employee.firstName} ${employee.lastName}" removed from section "${section.name}"`,
        details: `Removed employee ${employee.employeeId} from section ${section.name} (${section.code})`,
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to log employee removal:', auditErr);
    }

    res.json({
      success: true,
      message: 'Employee removed from section successfully'
    });
  } catch (error) {
    console.error('Remove employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove employee from section'
    });
  }
};

// @desc    Get all sections from MySQL sync tables (replaces HRIS cache)
// @route   GET /api/sections/hris
// @access  Public (for now)
const getHrisSections = async (req, res) => {
  try {
    console.log('📥 Fetching sections from MySQL sync tables...');
    
    const { sequelize } = require('../models/mysql');
    const { search, division } = req.query;
    
    // Build query
    let whereClause = '';
    const replacements = {};
    
    if (search) {
      whereClause = 'WHERE (s.HIE_NAME_4 LIKE :search OR s.HIE_CODE LIKE :search)';
      replacements.search = `%${search}%`;
    }
    
    if (division && division !== 'all') {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += 's.HIE_CODE_3 = :division';
      replacements.division = String(division);
    }
    
    // Fetch sections with employee counts
    const [sections] = await sequelize.query(`
      SELECT 
        s.*,
        d.HIE_NAME as division_name,
        COALESCE(e.emp_count, 0) as employee_count
      FROM sections_sync s
      LEFT JOIN divisions_sync d ON s.HIE_CODE_3 = d.HIE_CODE
      LEFT JOIN (
        SELECT SEC_CODE, COUNT(*) as emp_count 
        FROM employees_sync 
        WHERE IS_ACTIVE = 1 
        GROUP BY SEC_CODE
      ) e ON s.HIE_CODE = e.SEC_CODE
      ${whereClause}
      ORDER BY s.HIE_NAME_4 ASC
    `, { replacements });
    
    // Transform to frontend expected format
    const transformedSections = sections.map((section, index) => ({
      _id: `mysql_sec_${section.HIE_CODE}`,
      code: section.HIE_CODE || 'N/A',
      name: section.HIE_NAME_4 || 'Unknown Section',
      description: section.HIE_NAME_SINHALA || '',
      isActive: true,
      employeeCount: section.employee_count || 0,
      createdAt: section.created_at || new Date().toISOString(),
      status: 'ACTIVE',
      // Additional fields for compatibility
      hie_code: section.HIE_CODE,
      hie_name: section.HIE_NAME_4,
      hie_relationship: section.division_name || section.HIE_CODE_3,
      def_level: 4,
      division_code: section.HIE_CODE_3,
      division_name: section.division_name,
      source: 'MySQL'
    }));

    console.log(`✅ Successfully fetched ${transformedSections.length} sections from MySQL`);

    res.status(200).json({
      success: true,
      message: 'Sections fetched from MySQL sync tables',
      data: transformedSections,
      pagination: {
        page: 1,
        limit: transformedSections.length,
        total: transformedSections.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      },
      source: 'MySQL'
    });
    
  } catch (error) {
    console.error('❌ Get sections from MySQL error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections from MySQL',
      error: error.message
    });
  }
};

module.exports = {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
  getSectionEmployees,
  getSectionStats,
  toggleSectionStatus,
  assignEmployeeToSection,
  removeEmployeeFromSection,
  getHrisSections
};
