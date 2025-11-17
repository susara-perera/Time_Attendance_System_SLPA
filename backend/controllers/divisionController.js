const Division = require('../models/Division');
const Section = require('../models/Section');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { 
  readData, 
  getCachedOrFetch, 
  getCachedDivisions,
  getCachedSections,
  isCacheInitialized,
  initializeCache 
} = require('../services/hrisApiService');

// @desc    Get all divisions
// @route   GET /api/divisions
// @access  Private
const getDivisions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = req.query.limit ? parseInt(req.query.limit) : 1000, // Increased default limit to 1000
      sort = 'name',
      order = 'asc',
      search,
      isActive,
      source = 'local' // Add source parameter: 'local', 'hris', or 'both'
    } = req.query;

    // If source is 'hris', fetch from HRIS API
    if (source === 'hris') {
      return await getHrisDivisions(req, res);
    }

    // Build query
    let query = {};

    // Role-based filtering - removed restrictions for now to get all data
    // if (req.user.role === 'admin' && req.user.division) {
    //   query._id = req.user.division._id;
    // } else if (req.user.role === 'clerk' && req.user.division) {
    //   query._id = req.user.division._id;
    // }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Sort order
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj = { [sort]: sortOrder };

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    console.log('Fetching divisions with query:', query);
    
    const divisions = await Division.find(query)
      .populate('manager', 'firstName lastName email employeeId')
      .populate('employeeCount')
      .populate('sectionCount')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Division.countDocuments(query);

    console.log(`Found ${divisions.length} divisions out of ${total} total`);
    console.log('Division data:', divisions.map(d => ({ 
      id: d._id, 
      name: d.name, 
      code: d.code, 
      isActive: d.isActive,
      employeeCount: d.employeeCount,
      manager: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : 'No manager'
    })));

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: divisions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get divisions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting divisions',
      error: error.message
    });
  }
};

// @desc    Get single division
// @route   GET /api/divisions/:id
// @access  Private
const getDivision = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id)
      .populate('manager', 'firstName lastName email employeeId')
      .populate('employeeCount')
      .populate('sectionCount');

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'admin' || req.user.role === 'clerk') {
      if (!req.user.division || req.user.division._id.toString() !== division._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get division statistics
    const stats = await Division.getDivisionStats(division._id);

    res.status(200).json({
      success: true,
      data: {
        ...division.toObject(),
        stats
      }
    });

  } catch (error) {
    console.error('Get division error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting division'
    });
  }
};

// @desc    Create division
// @route   POST /api/divisions
// @access  Private
const createDivision = async (req, res) => {
  try {
    const { name, code } = req.body;

    // Check if division code already exists
    const existingDivision = await Division.findOne({ 
      $or: [{ code: code.toUpperCase() }, { name }] 
    });

    if (existingDivision) {
      return res.status(400).json({
        success: false,
        message: 'Division with this code or name already exists'
      });
    }

    // Create division with only name and code
    const division = new Division({
      name,
      code: code.toUpperCase()
    });

    await division.save();

    // Log division creation
    await AuditLog.createLog({
      user: req.user._id,
      action: 'division_created',
      entity: { type: 'Division', id: division._id, name: division.name },
      category: 'data_modification',
      severity: 'medium',
      description: 'New division created',
      details: `Created division: ${division.name} (${division.code})`,
      changes: {
        after: { name, code: code.toUpperCase() }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(201).json({
      success: true,
      message: 'Division created successfully',
      data: division
    });

  } catch (error) {
    console.error('Create division error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Division with this code or name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating division'
    });
  }
};

// @desc    Update division
// @route   PUT /api/divisions/:id
// @access  Private (super_admin only)
const updateDivision = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Store old values for audit
    const oldValues = {
      name: division.name,
      code: division.code,
      description: division.description,
      manager: division.manager,
      isActive: division.isActive
    };

    const {
      name,
      code,
      description,
      manager,
      location,
      workingHours,
      budget,
      contact,
      settings,
      isActive
    } = req.body;

    // Update fields
    if (name !== undefined) division.name = name;
    if (code !== undefined) division.code = code.toUpperCase();
    if (description !== undefined) division.description = description;
    if (location !== undefined) division.location = { ...division.location, ...location };
    if (workingHours !== undefined) division.workingHours = { ...division.workingHours, ...workingHours };
    if (budget !== undefined) division.budget = { ...division.budget, ...budget };
    if (contact !== undefined) division.contact = { ...division.contact, ...contact };
    if (settings !== undefined) division.settings = { ...division.settings, ...settings };
    if (isActive !== undefined) division.isActive = isActive;

    // Handle manager change
    if (manager !== undefined) {
      // Remove division from old manager
      if (division.manager) {
        await User.findByIdAndUpdate(division.manager, { $unset: { division: 1 } });
      }

      // Validate new manager
      if (manager) {
        const managerUser = await User.findById(manager);
        if (!managerUser) {
          return res.status(400).json({
            success: false,
            message: 'Manager not found'
          });
        }

        if (!['admin', 'super_admin'].includes(managerUser.role)) {
          return res.status(400).json({
            success: false,
            message: 'Manager must be an admin or super admin'
          });
        }

        // Assign division to new manager
        await User.findByIdAndUpdate(manager, { division: division._id });
      }

      division.manager = manager;
    }

    await division.save();

    // Log division update
    await AuditLog.createLog({
      user: req.user._id,
      action: 'division_updated',
      entity: { type: 'Division', id: division._id, name: division.name },
      category: 'data_modification',
      severity: 'medium',
      description: 'Division updated',
      details: `Updated division: ${division.name} (${division.code})`,
      changes: {
        before: oldValues,
        after: req.body
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    // Populate manager before sending response
    await division.populate('manager', 'firstName lastName email employeeId');

    res.status(200).json({
      success: true,
      message: 'Division updated successfully',
      data: division
    });

  } catch (error) {
    console.error('Update division error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Division code or name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating division'
    });
  }
};

// @desc    Delete division
// @route   DELETE /api/divisions/:id
// @access  Private (super_admin only)
const deleteDivision = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Check if division has employees
    const employeeCount = await User.countDocuments({ division: division._id });
    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete division with ${employeeCount} employees. Please reassign or remove employees first.`
      });
    }

    // Check if division has sections
    const sectionCount = await Section.countDocuments({ division: division._id });
    if (sectionCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete division with ${sectionCount} sections. Please delete sections first.`
      });
    }

    await Division.findByIdAndDelete(req.params.id);

    // Log division deletion
    await AuditLog.createLog({
      user: req.user._id,
      action: 'division_deleted',
      entity: { type: 'Division', id: division._id, name: division.name },
      category: 'data_modification',
      severity: 'high',
      description: 'Division deleted',
      details: `Deleted division: ${division.name} (${division.code})`,
      changes: {
        before: {
          name: division.name,
          code: division.code,
          description: division.description,
          manager: division.manager
        }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      },
      requiresReview: true
    });

    res.status(200).json({
      success: true,
      message: 'Division deleted successfully'
    });

  } catch (error) {
    console.error('Delete division error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting division'
    });
  }
};

// @desc    Get division employees
// @route   GET /api/divisions/:id/employees
// @access  Private
const getDivisionEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;

    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'admin' || req.user.role === 'clerk') {
      if (!req.user.division || req.user.division._id.toString() !== division._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Build query
    let query = { division: division._id };
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [employees, total] = await Promise.all([
      User.find(query)
        .populate('section', 'name code')
        .select('-password')
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get division employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting division employees'
    });
  }
};

// @desc    Get division sections
// @route   GET /api/divisions/:id/sections
// @access  Private
const getDivisionSections = async (req, res) => {
  try {
    const { page = 1, limit = 1000, isActive } = req.query; // Increased limit for testing

    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Temporarily comment out access permissions for testing
    // if (req.user && (req.user.role === 'admin' || req.user.role === 'clerk')) {
    //   if (!req.user.division || req.user.division._id.toString() !== division._id.toString()) {
    //     return res.status(403).json({
    //       success: false,
    //       message: 'Access denied'
    //     });
    //   }
    // }

    // Build query
    let query = { division: division._id };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [sections, total] = await Promise.all([
      Section.find(query)
        .populate('supervisor', 'firstName lastName email employeeId')
        .populate('employeeCount')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Section.countDocuments(query)
    ]);

    console.log(`Found ${sections.length} sections for division ${division.name}`); // Debug log

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: sections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get division sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting division sections'
    });
  }
};

// @desc    Get division statistics
// @route   GET /api/divisions/:id/stats
// @access  Private
const getDivisionStats = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'admin' || req.user.role === 'clerk') {
      if (!req.user.division || req.user.division._id.toString() !== division._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const stats = await Division.getDivisionStats(division._id);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get division stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting division statistics'
    });
  }
};

// @desc    Toggle division status
// @route   PATCH /api/divisions/:id/toggle-status
// @access  Private (super_admin only)
const toggleDivisionStatus = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id);

    if (!division) {
      return res.status(404).json({
        success: false,
        message: 'Division not found'
      });
    }

    const oldStatus = division.isActive;
    division.isActive = !division.isActive;
    await division.save();

    // Log status change
    await AuditLog.createLog({
      user: req.user._id,
      action: division.isActive ? 'division_activated' : 'division_deactivated',
      entity: { type: 'Division', id: division._id, name: division.name },
      category: 'data_modification',
      severity: 'medium',
      description: `Division ${division.isActive ? 'activated' : 'deactivated'}`,
      details: `${division.isActive ? 'Activated' : 'Deactivated'} division: ${division.name} (${division.code})`,
      changes: {
        before: { isActive: oldStatus },
        after: { isActive: division.isActive }
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        endpoint: req.originalUrl
      }
    });

    res.status(200).json({
      success: true,
      message: `Division ${division.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: division.isActive }
    });

  } catch (error) {
    console.error('Toggle division status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling division status'
    });
  }
};

// @desc    Get division sections from HRIS API (for attendance reports)
// @route   GET /api/divisions/:id/mysql-sections
// @access  Private
const getDivisionMySQLSections = async (req, res) => {
  try {
    const hrisApiService = require('../services/hrisApiService');
    const divisionId = req.params.id;

    console.log(`Getting HRIS sections for division ID: ${divisionId}`);

    // Fetch all sections from HRIS API
    let allSections = [];
    try {
      allSections = await hrisApiService.readData('hr_section_v', {}, '', false);
      console.log(`Fetched ${allSections.length} sections from HRIS API`);
    } catch (error) {
      console.error('Error fetching sections from HRIS:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch sections from HRIS API'
      });
    }

    // If divisionId is 'all', return all sections
    if (!divisionId || divisionId === 'all') {
      const formattedSections = allSections.map(section => ({
        _id: String(section.section_code || section.hie_code || section.code || ''),
        section_id: String(section.section_code || section.hie_code || section.code || ''),
        section_name: section.section_name || section.hie_name || section.name || 'Unknown Section',
        name: section.section_name || section.hie_name || section.name || 'Unknown Section',
        division_id: String(section.division_code || section.DIVISION_CODE || ''),
        division_name: section.division_name || section.DIVISION_NAME || '',
        isActive: true
      }));

      return res.status(200).json({
        success: true,
        data: formattedSections,
        count: formattedSections.length
      });
    }

    // Filter sections by division ID/code
    const filteredSections = allSections.filter(section => {
      const sectionDiv = String(section.division_code || section.DIVISION_CODE || section.hie_relationship || '');
      const divCode = String(divisionId);
      
      // Match by division code or partial match
      return sectionDiv === divCode || 
             sectionDiv.toLowerCase().includes(divCode.toLowerCase()) ||
             divCode.toLowerCase().includes(sectionDiv.toLowerCase());
    });

    // Format for frontend compatibility
    const formattedSections = filteredSections.map(section => ({
      _id: String(section.section_code || section.hie_code || section.code || ''),
      section_id: String(section.section_code || section.hie_code || section.code || ''),
      section_name: section.section_name || section.hie_name || section.name || 'Unknown Section',
      name: section.section_name || section.hie_name || section.name || 'Unknown Section',
      division_id: String(section.division_code || section.DIVISION_CODE || ''),
      division_name: section.division_name || section.DIVISION_NAME || '',
      isActive: true
    }));

    console.log(`Found ${formattedSections.length} HRIS sections for division ${divisionId}`);

    res.status(200).json({
      success: true,
      data: formattedSections,
      count: formattedSections.length
    });

  } catch (error) {
    console.error('Get division HRIS sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting division sections from HRIS API',
      error: error.message
    });
  }
};

// @desc    Get all divisions from HRIS API
// @route   GET /api/divisions/hris
// @access  Public (for now)
const getHrisDivisions = async (req, res) => {
  try {
    console.log('📥 Fetching divisions from HRIS (using cache)...');
    
    // Ensure cache is initialized
    if (!isCacheInitialized()) {
      console.log('🔄 Cache not initialized, initializing now...');
      await initializeCache();
    }
    
    // Try to get divisions from cache first
    let divisions = getCachedDivisions();
    
    // If not in cache, fetch and cache
    if (!divisions) {
      console.log('⚠️ Divisions not in cache, fetching from API...');
      const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
      divisions = allHierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
    }
    
    // Transform HRIS data to match frontend expectations
    const transformedDivisions = divisions.map((division, index) => ({
      _id: division.HIE_CODE || `hris_${index}`,
      code: division.HIE_CODE || 'N/A',
      name: division.HIE_NAME || 'Unknown Division',
      description: division.HIE_NAME_SINHALA || '',
      isActive: true, // Assume all HRIS divisions are active
      employeeCount: 0, // Will need separate call to get this
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      // Additional HRIS specific fields
      hie_code: division.HIE_CODE,
      hie_name: division.HIE_NAME,
      hie_relationship: division.HIE_RELATIONSHIP,
      def_level: division.DEF_LEVEL
    }));

    console.log(`Successfully fetched ${transformedDivisions.length} divisions from HRIS`);

    res.status(200).json({
      success: true,
      message: 'HRIS divisions fetched successfully',
      data: transformedDivisions,
      pagination: {
        page: 1,
        limit: transformedDivisions.length,
        total: transformedDivisions.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  } catch (error) {
    console.error('Get HRIS divisions error:', error.message);
    console.error('Falling back to local divisions...');
    
    try {
      // Fallback to local divisions with HRIS-like structure
      const localDivisions = await Division.find({ isActive: true })
        .populate('manager', 'firstName lastName email employeeId')
        .populate('employeeCount')
        .populate('sectionCount')
        .sort({ name: 1 });

      // Transform local divisions to match HRIS format
      const transformedLocalDivisions = localDivisions.map((division, index) => ({
        _id: division._id,
        code: division.code || `DIV${String(index + 1).padStart(3, '0')}`,
        name: division.name,
        description: division.description || '',
        isActive: division.isActive,
        employeeCount: division.employeeCount || 0,
        createdAt: division.createdAt?.toISOString() || new Date().toISOString(),
        status: division.isActive ? 'ACTIVE' : 'INACTIVE',
        // HRIS-like fields for compatibility
        hie_code: division.code || `DIV${String(index + 1).padStart(3, '0')}`,
        hie_name: division.name,
        hie_relationship: 'LOCAL_DB',
        def_level: 3,
        source: 'LOCAL_FALLBACK'
      }));

      console.log(`Fallback: returning ${transformedLocalDivisions.length} local divisions`);

      res.status(200).json({
        success: true,
        message: 'HRIS API unavailable. Showing local divisions as fallback.',
        data: transformedLocalDivisions,
        pagination: {
          page: 1,
          limit: transformedLocalDivisions.length,
          total: transformedLocalDivisions.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        fallback: true,
        originalError: 'HRIS API connection failed'
      });
    } catch (fallbackError) {
      console.error('Fallback to local divisions also failed:', fallbackError);
      res.status(500).json({
        success: false,
        message: 'Both HRIS API and local database are unavailable',
        error: error.message
      });
    }
  }
};

// @desc    Get combined divisions from both local DB and HRIS API
// @route   GET /api/divisions/combined
// @access  Public (for now)
const getCombinedDivisions = async (req, res) => {
  try {
    const { prioritize = 'hris' } = req.query; // 'hris' or 'local'

    let divisions = [];
    let hrisDivisions = [];
    let localDivisions = [];

    try {
      // Ensure cache is initialized
      if (!isCacheInitialized()) {
        await initializeCache();
      }
      
      // Fetch HRIS divisions from cache
      const hrisData = getCachedDivisions() || [];
      hrisDivisions = hrisData.map((division, index) => ({
        _id: `hris_${division.HIE_CODE || index}`,
        code: division.HIE_CODE || 'N/A',
        name: division.HIE_NAME || 'Unknown Division',
        description: division.HIE_NAME_SINHALA || '',
        isActive: true,
        employeeCount: 0,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE',
        source: 'HRIS',
        hie_code: division.HIE_CODE,
        hie_name: division.HIE_NAME,
        hie_relationship: division.HIE_RELATIONSHIP,
        def_level: division.DEF_LEVEL
      }));
    } catch (hrisError) {
      console.warn('Failed to fetch HRIS divisions:', hrisError.message);
    }

    try {
      // Fetch local divisions
      const localQuery = {};
      const localData = await Division.find(localQuery)
        .populate('manager', 'firstName lastName email employeeId')
        .populate('employeeCount')
        .populate('sectionCount')
        .sort({ name: 1 });

      localDivisions = localData.map(division => ({
        ...division.toObject(),
        source: 'LOCAL',
        createdAt: division.createdAt?.toISOString() || new Date().toISOString()
      }));
    } catch (localError) {
      console.warn('Failed to fetch local divisions:', localError.message);
    }

    // Combine divisions based on priority
    if (prioritize === 'hris') {
      divisions = [...hrisDivisions, ...localDivisions];
    } else {
      divisions = [...localDivisions, ...hrisDivisions];
    }

    // Remove duplicates based on name (case insensitive)
    const uniqueDivisions = divisions.filter((division, index, self) => 
      index === self.findIndex(d => 
        d.name.toLowerCase() === division.name.toLowerCase()
      )
    );

    res.status(200).json({
      success: true,
      message: 'Combined divisions fetched successfully',
      data: uniqueDivisions,
      pagination: {
        page: 1,
        limit: uniqueDivisions.length,
        total: uniqueDivisions.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      },
      meta: {
        hrisCount: hrisDivisions.length,
        localCount: localDivisions.length,
        totalCount: uniqueDivisions.length,
        prioritize
      }
    });
  } catch (error) {
    console.error('Get combined divisions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting combined divisions'
    });
  }
};

module.exports = {
  getDivisions,
  getDivision,
  createDivision,
  updateDivision,
  deleteDivision,
  getDivisionEmployees,
  getDivisionSections,
  getDivisionMySQLSections,
  getDivisionStats,
  toggleDivisionStatus,
  getHrisDivisions,
  getCombinedDivisions
};
