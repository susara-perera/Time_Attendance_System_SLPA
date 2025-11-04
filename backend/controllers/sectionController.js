const Section = require('../models/Section');
const User = require('../models/User');
const Division = require('../models/Division');
const AuditLog = require('../models/AuditLog');
const { validationResult } = require('express-validator');
const { 
  readData, 
  getCachedOrFetch, 
  getCachedSections,
  isCacheInitialized,
  initializeCache 
} = require('../services/hrisApiService');

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

// @desc    Get all sections from HRIS API
// @route   GET /api/sections/hris
// @access  Public (for now)
const getHrisSections = async (req, res) => {
  try {
    console.log('📥 Fetching sections from HRIS (using cache)...');
    
    // Ensure cache is initialized
    if (!isCacheInitialized()) {
      console.log('🔄 Cache not initialized, initializing now...');
      await initializeCache();
    }
    
    // Try to get sections from cache first
    let sections = getCachedSections();
    
    // If not in cache, fetch and cache
    if (!sections) {
      console.log('⚠️ Sections not in cache, fetching from API...');
      const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
      sections = allHierarchy.filter(item => item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4');
    }
    
    // Get divisions for mapping
    const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
    const divisions = allHierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
    const divisionMap = {};
    divisions.forEach(div => {
      divisionMap[div.HIE_CODE] = div.HIE_NAME;
    });
    
    // Transform HRIS data to match frontend expectations
    const transformedSections = sections.map((section, index) => {
      const divisionName = divisionMap[section.HIE_RELATIONSHIP] || `Division ${section.HIE_RELATIONSHIP}`;
      
      return {
        _id: section.HIE_CODE || `hris_section_${index}`,
        code: section.HIE_CODE || 'N/A',
        name: section.HIE_NAME || 'Unknown Section',
        description: section.HIE_NAME_SINHALA || '',
        isActive: true, // Assume all HRIS sections are active
        employeeCount: 0, // Will need separate call to get this
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
        // Additional HRIS specific fields
        hie_code: section.HIE_CODE,
        hie_name: section.HIE_NAME,
        hie_relationship: divisionName, // Use division name instead of code
        def_level: section.DEF_LEVEL,
        division_code: section.HIE_RELATIONSHIP, // Keep original code for reference
        division_name: divisionName // Explicit division name field
      };
    });

    console.log(`Successfully fetched ${transformedSections.length} sections from HRIS`);

    res.status(200).json({
      success: true,
      message: 'HRIS sections fetched successfully',
      data: transformedSections,
      pagination: {
        page: 1,
        limit: transformedSections.length,
        total: transformedSections.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  } catch (error) {
    console.error('Get HRIS sections error:', error.message);
    console.error('Falling back to local sections...');
    
    try {
      // Fallback to local sections with HRIS-like structure
      const Section = require('../models/Section');
      const localSections = await Section.find({ isActive: true })
        .populate('division', 'name code')
        .populate('supervisor', 'firstName lastName email employeeId')
        .populate('employeeCount')
        .sort({ name: 1 });

      // Transform local sections to match HRIS format
      const transformedLocalSections = localSections.map((section, index) => ({
        _id: section._id,
        code: section.code || `SEC${String(index + 1).padStart(3, '0')}`,
        name: section.name,
        description: section.description || '',
        isActive: section.isActive,
        employeeCount: section.employeeCount || 0,
        createdAt: section.createdAt?.toISOString() || new Date().toISOString(),
        status: section.isActive ? 'ACTIVE' : 'INACTIVE',
        // HRIS-like fields for compatibility
        hie_code: section.code || `SEC${String(index + 1).padStart(3, '0')}`,
        hie_name: section.name,
        hie_relationship: section.division ? section.division.name : 'LOCAL_DB',
        def_level: 4,
        source: 'LOCAL_FALLBACK'
      }));

      console.log(`Fallback: returning ${transformedLocalSections.length} local sections`);

      res.status(200).json({
        success: true,
        message: 'HRIS API unavailable. Showing local sections as fallback.',
        data: transformedLocalSections,
        pagination: {
          page: 1,
          limit: transformedLocalSections.length,
          total: transformedLocalSections.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        fallback: true,
        originalError: 'HRIS API connection failed'
      });
    } catch (fallbackError) {
      console.error('Fallback to local sections also failed:', fallbackError);
      res.status(500).json({
        success: false,
        message: 'Both HRIS API and local database are unavailable',
        error: error.message
      });
    }
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
