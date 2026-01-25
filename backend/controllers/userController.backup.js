const User = require('../models/mysql/User');
const Division = require('../models/mysql/Division');
const Section = require('../models/mysql/Section');
const AuditLog = require('../models/mysql/AuditLog');
const { Op } = require('sequelize');
// Note: HRIS cache is no longer used - data comes from MySQL sync tables

// @desc    Get all users
// @route   GET /api/users
// @access  Private (admin, super_admin)
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      search,
      role,
      division,
      section,
      isActive
    } = req.query;

    // Build Sequelize where clause
    let where = {};

    // Role-based filtering (skip if no user auth)
    if (req.user && req.user.role !== 'super_admin') {
      if (req.user.role === 'admin' && req.user.divisionId) {
        where.divisionId = req.user.divisionId;
      } else if (req.user.role === 'clerk' && req.user.sectionId) {
        where.sectionId = req.user.sectionId;
      }
    }

    // Additional filters
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { employeeId: { [Op.like]: `%${search}%` } }
      ];
    }

    if (role) where.role = role;
    if (division) where.divisionId = division;
    if (section) where.sectionId = section;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // Sort order
    const orderClause = [[sort, order.toUpperCase()]];

    // Execute query with pagination
    const offset = (page - 1) * limit;
    
    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: [
        { model: Division, as: 'division', attributes: ['name', 'code'] },
        { model: Section, as: 'section', attributes: ['name', 'code'] }
      ],
      order: orderClause,
      offset,
      limit: parseInt(limit)
    });

    // Calculate pagination
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting users'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
const getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        { model: Division, as: 'division', attributes: ['id', 'name', 'code', 'workingHours'] },
        { model: Section, as: 'section', attributes: ['id', 'name', 'code'] }
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check access permissions (skip if no user auth)
    if (req.user && req.user.role !== 'super_admin' && 
        req.user.role !== 'admin' && 
        req.user.id !== user.id) {
      
      // Clerks can only view users in their section
      if (req.user.role === 'clerk') {
        if (!req.user.sectionId || !user.sectionId || 
            req.user.sectionId !== user.sectionId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user'
    });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private (admin, super_admin)
const createUser = async (req, res) => {
  try {
    console.log('=== CREATE USER REQUEST ===');
    console.log('Request body:', { ...req.body, password: '***', confirmPassword: '***' });
    
    const {
      firstName,
      lastName,
      email,
      employeeId,
      password,
      confirmPassword,
      role,
      division,
      section,
      phone,
      address,
      designation,
      salary,
      permissions
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !employeeId || !password || !role) {
      console.warn('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Validate password strength (simplified)
    if (password.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Validate role against allowed values
    const allowedRoles = ['super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'];
    if (!allowedRoles.includes(role)) {
      console.warn('Invalid role specified:', role);
      return res.status(400).json({
        success: false,
        message: `Invalid role specified: ${role}. Must be one of: ${allowedRoles.join(', ')}`
      });
    }

    // Check if role exists in database (optional check - creates role if missing)
    const Role = require('../models/mysql/Role');
    try {
      let roleDoc = await Role.findOne({ where: { value: role } });
      if (!roleDoc) {
        console.warn(`Role '${role}' not found in database. Creating it now...`);
        const roleLabels = {
          'super_admin': 'Super Admin',
          'admin': 'Administrator',
          'clerk': 'Clerk',
          'administrative_clerk': 'Administrative Clerk',
          'employee': 'Employee'
        };
        roleDoc = await Role.create({
          value: role,
          label: roleLabels[role] || role,
          name: roleLabels[role] || role,
          description: `${roleLabels[role] || role} role`
        });
        console.log(`Role '${role}' created successfully`);
      }
    } catch (roleError) {
      console.error('Error checking/creating role:', roleError);
      // Continue anyway - the role value itself is validated
    }

    // Division is required for all roles except super_admin
    if (role !== 'super_admin' && !division) {
      return res.status(400).json({
        success: false,
        message: 'Division is required for this role'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { employeeId }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

    // SIMPLIFIED: Resolve division and section IDs directly from database
    let divisionId = null;
    let sectionId = null;

    if (division) {
      // Try to find division by name or ID
      let divisionRecord = null;
      if (!isNaN(division)) {
        divisionRecord = await Division.findByPk(division);
      } else {
        divisionRecord = await Division.findOne({ where: { name: String(division) } });
      }
      
      if (divisionRecord) {
        divisionId = divisionRecord.id;
        console.log('Division resolved:', divisionRecord.name, '(ID:', divisionId, ')');
      } else {
        console.warn('Division not found:', division);
      }
    }

    if (section) {
      // Try to find section by name or ID
      let sectionRecord = null;
      if (!isNaN(section)) {
        sectionRecord = await Section.findByPk(section);
      } else {
        sectionRecord = await Section.findOne({ where: { name: String(section) } });
      }
      
      if (sectionRecord) {
        sectionId = sectionRecord.id;
        console.log('Section resolved:', sectionRecord.name, '(ID:', sectionId, ')');
      } else {
        console.warn('Section not found:', section);
      }
    }

    // Get permissions from role or use provided ones
    let userPermissions = permissions || {};
    try {
      const MySQLRole = require('../models/mysql/Role');
      const roleDoc = await MySQLRole.findOne({ where: { value: role } });
      if (roleDoc && roleDoc.permissions) {
        userPermissions = roleDoc.permissions;
      }
    } catch (roleError) {
      console.error('Error fetching role permissions:', roleError);
    }

    // Create user with resolved IDs
    const userData = {
      firstName,
      lastName,
      email,
      employeeId,
      password,
      role,
      phone,
      address,
      designation,
      salary,
      permissions: userPermissions,
      divisionId: divisionId,
      sectionId: sectionId
    };

    console.log('Creating user with data:', {
      ...userData,
      password: '***hidden***'
    });

    const user = await User.create(userData);
    console.log('User created successfully. ID:', user.id);

    // Log user creation (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        userId: req.user.id,
        action: 'user_created',
        entity: { type: 'User', id: user.id, name: user.email },
        category: 'data_modification',
        severity: 'medium',
        description: 'New user created',
        details: `Created user: ${user.firstName} ${user.lastName} (${user.employeeId})`,
        changes: {
          after: {
            firstName,
            lastName,
            email,
            employeeId,
            role,
            divisionId,
            sectionId
          }
        },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    }

    // Fetch user with associations for response
    const userWithAssociations = await User.findByPk(user.id, {
      include: [
        { model: Division, as: 'division', attributes: ['id', 'name', 'code'] },
        { model: Section, as: 'section', attributes: ['id', 'name', 'code'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithAssociations || user
    });

  } catch (error) {
    console.error('Create user error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Handle duplicate key error
    if (error.code === 11000 || error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError' || error.name === 'SequelizeValidationError') {
      const errors = error.errors ? error.errors.map(err => err.message) : [error.message];
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: 'Server error creating user'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
      }
      
      // Fallback: Try id (if it's a number)
      if (!resolvedDivision && !isNaN(division)) {
        resolvedDivision = await Division.findByPk(division);
        if (resolvedDivision) {
          console.log('Division found by ID:', resolvedDivision.name);
        }
      }
      
      // Fallback: Try code (case-insensitive)
      if (!resolvedDivision) {
        resolvedDivision = await Division.findOne({ where: { code: String(division).toUpperCase() } });
        if (resolvedDivision) {
          console.log('Division found by code:', resolvedDivision.name);
        }
      }

      if (!resolvedDivision) {
        console.log('Division not found locally, checking HRIS cache for:', division);

        // Try HRIS cache to find a matching division (prioritize NAME matching since frontend sends names)
        try {
          const hrisDivisions = getCachedDivisions && getCachedDivisions();
          if (hrisDivisions && hrisDivisions.length) {
            // Match by name first (HIE_NAME_3), then by code/id
            const match = hrisDivisions.find(d =>
              String(d.name || d.HIE_NAME_3 || d.hie_name) === String(division) ||
              String(d.HIE_NAME_3) === String(division) ||
              String(d.hie_name) === String(division) ||
              String(d._id) === String(division) ||
              String(d.code) === String(division) ||
              String(d.HIE_CODE) === String(division) ||
              String(d.hie_code) === String(division)
            );

            if (match) {
              const divisionName = match.name || match.HIE_NAME_3 || match.hie_name || `Division ${match._id}`;
              // Generate a code from the HRIS code or create one from name
              const codeCandidate = String(match.code || match.hie_code || match.HIE_CODE || match._id || divisionName.substring(0, 10).replace(/\s+/g, '_')).toUpperCase();
              
              // Check if division already exists by name
              resolvedDivision = await Division.findOne({ where: { name: divisionName } });
              
              if (!resolvedDivision) {
                // Try by code
                resolvedDivision = await Division.findOne({ where: { code: codeCandidate } });
              }

              if (!resolvedDivision) {
                console.log('Creating local Division from HRIS match:', divisionName, codeCandidate);
                resolvedDivision = await Division.create({
                  name: divisionName,
                  code: codeCandidate,
                  description: match.description || match.hie_name || ''
                });
                console.log('Created local division from HRIS:', resolvedDivision.name);
              } else {
                console.log('Matched HRIS division to existing local division:', resolvedDivision.name);
              }
            }
          }
        } catch (hrisErr) {
          console.error('HRIS lookup error while resolving division:', hrisErr.message || hrisErr);
        }

        // If still not resolved, query HRIS hierarchy directly as a fallback
        if (!resolvedDivision) {
          try {
            const hierarchy = await getCachedOrFetch('company_hierarchy', {});
            // Match by name first (HIE_NAME_3), then by code/id
            const divMatch = (hierarchy || []).find(item => (item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3') && (
              String(item.HIE_NAME_3 || item.hie_name_3) === String(division) ||
              String(item.HIE_NAME || item.hie_name) === String(division) ||
              String(item.name) === String(division) ||
              String(item.HIE_CODE || item.hie_code) === String(division) ||
              String(item.HIE_CODE_3 || item.hie_code_3) === String(division) ||
              String(item.code) === String(division) ||
              String(item._id) === String(division)
            ));

            if (divMatch) {
              const divisionName = divMatch.HIE_NAME_3 || divMatch.HIE_NAME || divMatch.name || `Division ${divMatch._id}`;
              const codeCandidate = String(divMatch.code || divMatch.hie_code || divMatch.HIE_CODE || divMatch._id || divisionName.substring(0, 10).replace(/\s+/g, '_')).toUpperCase();
              
              let createdDiv = await Division.findOne({ name: divisionName });
              if (!createdDiv) {
                createdDiv = await Division.findOne({ code: codeCandidate });
              }
              if (!createdDiv) {
                createdDiv = new Division({ 
                  name: divisionName, 
                  code: codeCandidate, 
                  description: divMatch.description || '' 
                });
                await createdDiv.save();
                console.log('Created local division from HRIS hierarchy:', createdDiv.name);
              }
              resolvedDivision = createdDiv;
            }
          } catch (hierErr) {
            console.error('HRIS hierarchy fallback error while resolving division:', hierErr.message || hierErr);
          }
        }

        if (!resolvedDivision) {
          // List available divisions to help debugging
          const availableDivisions = await Division.findAll({ attributes: ['id', 'name', 'code'], limit: 20 });
          console.log('Available divisions in system:', availableDivisions.map(d => `${d.name} (${d.code}) - ID: ${d.id}`));

          return res.status(404).json({
            success: false,
            message: `Division not found in system: ${division}. Please select a valid division from the list.`,
            availableDivisions: availableDivisions.map(d => ({
              id: d.id,
              name: d.name,
              code: d.code
            }))
          });
        }
      }
    }

    // Validate section exists and belongs to resolved division (now primarily by NAME from HRIS HIE_NAME_4)
    let resolvedSection = null;
    if (section) {
      console.log('Looking up section by name:', section);
      
      // Try name FIRST (since frontend now sends section name)
      resolvedSection = await Section.findOne({ where: { name: String(section) } });
      if (resolvedSection) {
        console.log('Section found by name:', resolvedSection.name);
      }
      
      // Fallback: Try id (if it's a number)
      if (!resolvedSection && !isNaN(section)) {
        resolvedSection = await Section.findByPk(section);
        if (resolvedSection) {
          console.log('Section found by ID:', resolvedSection.name);
        }
      }
      
      // Fallback: Try code
      if (!resolvedSection) {
        resolvedSection = await Section.findOne({ where: { code: String(section) } });
        if (resolvedSection) {
          console.log('Section found by code:', resolvedSection.name);
        }
      }

      if (!resolvedSection) {
        console.log('Section not found locally, checking HRIS cache for:', section);

        // Try HRIS cache to find matching section (prioritize NAME matching since frontend sends names)
        try {
          const hrisSections = getCachedSections && getCachedSections();
          if (hrisSections && hrisSections.length) {
            // Match by name first (HIE_NAME_4), then by code/id
            const match = hrisSections.find(s =>
              String(s.HIE_NAME_4 || s.hie_name_4) === String(section) ||
              String(s.HIE_NAME || s.hie_name) === String(section) ||
              String(s.name) === String(section) ||
              String(s.HIE_CODE) === String(section) ||
              String(s.HIE_CODE_3) === String(section) ||
              String(s.code) === String(section) ||
              String(s.SECTION_ID) === String(section)
            );

            if (match) {
              const sectionName = match.HIE_NAME_4 || match.hie_name_4 || match.HIE_NAME || match.hie_name || match.name || `Section ${match._id}`;
              // Generate a code from the HRIS code or create one from name
              const codeCandidate = String(match.HIE_CODE_3 || match.HIE_CODE || match.code || match.SECTION_ID || match.id || sectionName.substring(0, 10).replace(/\s+/g, '_')).toUpperCase();
              
              // Check if section already exists by name
              let localSection = await Section.findOne({ where: { name: sectionName } });
              
              if (!localSection) {
                // Try by code
                localSection = await Section.findOne({ where: { code: codeCandidate } });
              }

              if (!localSection) {
                // Ensure we have a local division to attach to
                let sectionDivisionId = null;
                if (resolvedDivision) {
                  sectionDivisionId = resolvedDivision.id;
                } else if (match.HIE_RELATIONSHIP) {
                  // HIE_RELATIONSHIP is the division name for sections
                  const possibleDiv = await Division.findOne({ where: { name: match.HIE_RELATIONSHIP } });
                  if (possibleDiv) sectionDivisionId = possibleDiv.id;
                }

                // Use a system user as createdBy when req.user is not present
                let createdByUserId = req.user ? req.user.id : null;
                if (!createdByUserId) {
                  const systemAdmin = await User.findOne({ where: { role: 'super_admin' }, attributes: ['id'] });
                  createdByUserId = systemAdmin ? systemAdmin.id : null;
                }

                // Create local section if we have a division and a createdBy
                if (sectionDivisionId && createdByUserId) {
                  localSection = await Section.create({
                    name: sectionName,
                    code: codeCandidate || `SEC${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    divisionId: sectionDivisionId,
                    description: match.description || sectionName,
                    createdBy: createdByUserId
                  });
                  console.log('Created local section from HRIS:', localSection.name);
                }

                // If cannot create local section, fallback to pseudo object
                if (!localSection) {
                  console.log('Could not create local section - falling back to HRIS values');
                  resolvedSection = {
                    _id: null,
                    name: sectionName,
                    code: codeCandidate
                  };
                } else {
                  resolvedSection = localSection;
                }
              } else {
                resolvedSection = localSection;
              }
            }
          }
        } catch (hrisErr) {
          console.error('HRIS lookup error while resolving section:', hrisErr.message || hrisErr);
        }

        // Fallback: query HRIS hierarchy directly for section (DEF_LEVEL 4)
        if (!resolvedSection) {
          try {
            let hierarchy = [];
            // Try cached hierarchy first
            try {
              hierarchy = await getCachedOrFetch('company_hierarchy', {});
            } catch (e) {
              console.warn('Could not get cached hierarchy, attempting fresh HRIS read');
            }

            // If cached failed or empty, try fetching directly
            if (!hierarchy || !hierarchy.length) {
              try {
                hierarchy = await readData('company_hierarchy', {});
              } catch (e) {
                console.error('Failed to read HRIS hierarchy directly:', e.message || e);
              }
            }

            const secMatch = (hierarchy || []).find(item => (item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4') && (
              String(item.HIE_CODE || item.hie_code) === String(section) ||
              String(item.HIE_CODE_3 || item.hie_code_3) === String(section) ||
              String(item.code) === String(section) ||
              String(item.SECTION_ID || item.section_id) === String(section) ||
              String(item.HIE_NAME_4 || item.hie_name_4) === String(section) ||
              String(item.HIE_NAME || item.hie_name) === String(section) ||
              String(item.name) === String(section)
            ));

            if (secMatch) {
              console.log('Found HRIS section match in hierarchy for:', section, secMatch.HIE_NAME_4 || secMatch.HIE_NAME || secMatch.name);

              // Ensure we have/created a local division for this section
              let sectionDivisionId = null;
              if (resolvedDivision) {
                sectionDivisionId = resolvedDivision._id;
              } else if (secMatch.hie_relationship || secMatch.HIE_RELATIONSHIP) {
                const relName = secMatch.hie_relationship || secMatch.HIE_RELATIONSHIP;
                const divMatch = (hierarchy || []).find(d => (d.DEF_LEVEL === 3 || d.DEF_LEVEL === '3') && (
                  String(d.HIE_NAME_3 || d.hie_name_3) === String(relName) ||
                  String(d.HIE_NAME || d.hie_name) === String(relName) ||
                  String(d.name) === String(relName) ||
                  String(d._id) === String(relName) ||
                  String(d.code) === String(relName)
                ));
                if (divMatch) {
                  const codeCandidateDiv = String(divMatch.code || divMatch.hie_code || divMatch._id).toUpperCase();
                  let createdDiv = await Division.findOne({ $or: [{ code: codeCandidateDiv }, { name: divMatch.HIE_NAME_3 || divMatch.HIE_NAME || divMatch.name }] });
                  if (!createdDiv) {
                    createdDiv = new Division({ name: divMatch.HIE_NAME_3 || divMatch.HIE_NAME || divMatch.name, code: codeCandidateDiv, description: divMatch.description || '' });
                    await createdDiv.save();
                  }
                  sectionDivisionId = createdDiv._id;
                  if (!resolvedDivision) resolvedDivision = createdDiv;
                }
              }

              const codeCandidate = String(secMatch.HIE_CODE_3 || secMatch.hie_code_3 || secMatch.HIE_CODE || secMatch.hie_code || secMatch.code || secMatch.SECTION_ID || secMatch.id || secMatch.section_code || secMatch.section_id || '').toUpperCase();
              let localSection = await Section.findOne({ $or: [{ code: codeCandidate }, { name: secMatch.HIE_NAME_4 || secMatch.hie_name_4 || secMatch.HIE_NAME || secMatch.hie_name || secMatch.name }] });

              if (!localSection) {
                // Use a system user as createdBy when req.user is not present
                let createdByUserId = req.user ? req.user._id : null;
                if (!createdByUserId) {
                  const systemAdmin = await User.findOne({ role: 'super_admin' }).select('_id');
                  createdByUserId = systemAdmin ? systemAdmin._id : null;
                }

                if (sectionDivisionId && createdByUserId) {
                  localSection = new Section({
                    name: secMatch.HIE_NAME_4 || secMatch.hie_name_4 || secMatch.HIE_NAME || secMatch.hie_name || secMatch.name,
                    code: codeCandidate || `SEC${String(Math.floor(Math.random() * 9000) + 1000)}`,
                    division: sectionDivisionId,
                    description: secMatch.description || secMatch.HIE_NAME_4 || secMatch.hie_name_4 || '' ,
                    createdBy: createdByUserId
                  });
                  await localSection.save();
                  console.log('Created local section from HRIS hierarchy fallback:', localSection.name);
                } else {
                  // Fall back to pseudo section object with names/codes
                  resolvedSection = {
                    _id: null,
                    name: secMatch.HIE_NAME_4 || secMatch.hie_name_4 || secMatch.HIE_NAME || secMatch.hie_name || secMatch.name,
                    code: secMatch.HIE_CODE_3 || secMatch.hie_code_3 || secMatch.HIE_CODE || secMatch.hie_code || secMatch.code
                  };
                }

                if (localSection) resolvedSection = localSection;
              } else {
                resolvedSection = localSection;
              }
            }
          } catch (hierErr) {
            console.error('HRIS hierarchy fallback error while resolving section:', hierErr.message || hierErr);
          }
        }

        if (!resolvedSection) {
          // List available sections to help debugging
          const availableSections = await Section.findAll({ attributes: ['id', 'name', 'code', 'divisionId'], limit: 20 });
          console.log('Available sections in system:', availableSections.map(s => `${s.name} (${s.code}) - ID: ${s.id}`));

          return res.status(404).json({
            success: false,
            message: `Section not found in system: ${section}. Please select a valid section from the list.`,
            availableSections: availableSections.map(s => ({
              id: s.id,
              name: s.name,
              code: s.code,
              divisionId: s.divisionId
            })),
            hint: resolvedDivision ? `Try selecting a section that belongs to division: ${resolvedDivision.name}` : null
          });
        }
      }

      // If section was just created or has a valid division, we trust the HRIS data
      // Only warn (don't block) if there's a mismatch for existing sections
      if (resolvedDivision && resolvedSection && resolvedSection._id && resolvedSection.division) {
        const sectionDivisionId = String(resolvedSection.division || '');
        const divisionId = String(resolvedDivision._id);
        if (sectionDivisionId && divisionId && sectionDivisionId !== divisionId) {
          console.warn('Section-Division mismatch (allowing since HRIS data is trusted):', {
            section: resolvedSection.name,
            sectionDivision: sectionDivisionId,
            expectedDivision: divisionId
          });
          // Update section to belong to the correct division
          try {
            await Section.findByIdAndUpdate(resolvedSection._id, { division: resolvedDivision._id });
            console.log('Updated section division to match:', resolvedDivision.name);
          } catch (updateErr) {
            console.warn('Could not update section division:', updateErr.message);
          }
        } else {
          console.log('Section belongs to the correct division');
        }
      }
    }

    // Set permissions from role or use provided permissions
    let userPermissions = permissions || {};
    
    // Try to get permissions from the role
    try {
      const MySQLRole = require('../models/mysql/Role');
      const roleDoc = await MySQLRole.findOne({ where: { value: role } });
      if (roleDoc && roleDoc.permissions) {
        userPermissions = roleDoc.permissions;
        console.log(`Using permissions from role '${role}':`, userPermissions);
      } else {
        console.log(`Role '${role}' not found or has no permissions, using defaults`);
        // Fallback to hardcoded defaults if role not found
        if (role === 'admin') {
          userPermissions = {
            users: { create: true, read: true, update: true, delete: false },
            attendance: { create: true, read: true, update: true, delete: false },
            reports: { create: true, read: true, update: false, delete: false },
            divisions: { create: false, read: true, update: false, delete: false },
            sections: { create: true, read: true, update: true, delete: false },
            settings: { create: false, read: true, update: false, delete: false },
            roles: { create: false, read: true, update: false, delete: false },
            rolesManage: { create: false, read: true, update: false, delete: false }
          };
        } else if (role === 'clerk') {
          userPermissions = {
            users: { create: false, read: true, update: false, delete: false },
            attendance: { create: true, read: true, update: true, delete: false },
            reports: { create: true, read: true, update: false, delete: false },
            divisions: { create: false, read: true, update: false, delete: false },
            sections: { create: false, read: true, update: false, delete: false },
            settings: { create: false, read: false, update: false, delete: false },
            roles: { create: false, read: false, update: false, delete: false },
            rolesManage: { create: false, read: false, update: false, delete: false }
          };
        } else if (role === 'administrative_clerk') {
          userPermissions = {
            users: { create: true, read: true, update: true, delete: false },
            attendance: { create: true, read: true, update: true, delete: false },
            reports: { create: true, read: true, update: false, delete: false },
            divisions: { create: false, read: true, update: false, delete: false },
            sections: { create: false, read: true, update: true, delete: false },
            settings: { create: false, read: true, update: false, delete: false },
            roles: { create: false, read: true, update: false, delete: false },
            rolesManage: { create: false, read: true, update: false, delete: false }
          };
        } else if (role === 'super_admin') {
          userPermissions = {
            users: { create: true, read: true, update: true, delete: true },
            attendance: { create: true, read: true, update: true, delete: true },
            reports: { create: true, read: true, update: true, delete: true },
            divisions: { create: true, read: true, update: true, delete: true },
            sections: { create: true, read: true, update: true, delete: true },
            settings: { create: true, read: true, update: true, delete: true },
            roles: { create: true, read: true, update: true, delete: true },
            rolesManage: { create: true, read: true, update: true, delete: true }
          };
        } else {
          // employee permissions
          userPermissions = {
            users: { create: false, read: false, update: false, delete: false },
            attendance: { create: true, read: true, update: false, delete: false },
            reports: { create: false, read: false, update: false, delete: false },
            divisions: { create: false, read: false, update: false, delete: false },
            sections: { create: false, read: false, update: false, delete: false },
            settings: { create: false, read: false, update: false, delete: false },
            roles: { create: false, read: false, update: false, delete: false },
            rolesManage: { create: false, read: false, update: false, delete: false }
          };
        }
      }
    } catch (roleError) {
      console.error('Error fetching role permissions:', roleError);
      // Continue with provided permissions or defaults
    }

    // Final validation: ensure division is set for non-super_admin roles
    const finalDivisionId = resolvedDivision ? resolvedDivision.id : division;
    if (role !== 'super_admin' && !finalDivisionId) {
      return res.status(400).json({
        success: false,
        message: 'Division is required for this role'
      });
    }

    // Create user (use resolved Division/Section ids when available)
    const userData = {
      firstName,
      lastName,
      email,
      employeeId,
      password,
      role,
      phone,
      address,
      designation,
      salary,
      permissions: userPermissions
    };

    // Only add division if it exists (required for non-super_admin)
    if (finalDivisionId) {
      userData.divisionId = finalDivisionId;
      // Add division name and code if we resolved the division
      if (resolvedDivision) {
        userData.divisionName = resolvedDivision.name;
        userData.divisionCode = resolvedDivision.code;
      }
    }

    // Only add section if it exists (optional)
    if (resolvedSection) {
      userData.sectionId = resolvedSection.id;
      // Add section name and code
      userData.sectionName = resolvedSection.name;
      userData.sectionCode = resolvedSection.code;
    } else if (section) {
      userData.sectionId = section;
    }

    console.log('Creating user with data:', {
      ...userData,
      password: '***hidden***'
    });
    console.log('Password received for new user:', password ? `Yes (length: ${password.length})` : 'No');

    const user = await User.create(userData);
    console.log('User saved successfully. Password should be hashed now.');

    // Log user creation (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        userId: req.user.id,
        action: 'user_created',
        entity: { type: 'User', id: user.id, name: user.email },
        category: 'data_modification',
        severity: 'medium',
        description: 'New user created',
        details: `Created user: ${user.fullName} (${user.employeeId})`,
        changes: {
          after: {
            firstName,
            lastName,
            email,
            employeeId,
            role,
            division,
            section
          }
        },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    }

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      await logRecentActivity({
        title: 'New User Created',
        description: `"${user.fullName}" account created`,
        activity_type: 'user_created',
        icon: 'bi bi-person-plus',
        entity_id: user.id?.toString(),
        entity_name: user.fullName,
        user_id: req.user?.id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });

      console.log(`[MySQL] ✅ Recent activity logged for user creation: ${user.fullName}`);
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log user creation activity:', activityErr);
    }

    // Fetch user with associations for response
    const userWithAssociations = await User.findByPk(user.id, {
      include: [
        { model: Division, as: 'division', attributes: ['id', 'name', 'code'] },
        { model: Section, as: 'section', attributes: ['id', 'name', 'code'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithAssociations || user
    });

  } catch (error) {
    console.error('Create user error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        success: false,
        message: `User with this ${field} already exists`
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: 'Server error creating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store old values for audit
    const oldValues = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      division: user.division,
      section: user.section,
      isActive: user.isActive,
      permissions: user.permissions
    };

    const {
      firstName,
      lastName,
      email,
      employeeId,
      role,
      division,
      section,
      phone,
      address,
      designation,
      salary,
      isActive,
      permissions
    } = req.body;

    // Update basic fields (always allowed)
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (designation !== undefined) user.designation = designation;
    if (salary !== undefined) user.salary = salary;

    // Resolve division/section FIRST (before role checks) to prevent string assignment to ObjectId fields
    let resolvedDivision = null;
    let resolvedSection = null;

    // Resolve division when provided as name (HIE_NAME_3) or id/code
    if (division !== undefined) {
      console.log('Update: resolving division:', division, 'Type:', typeof division);
      if (division && division !== '' && division !== 'N/A') {
        console.log('Update: resolving division:', division, 'Type:', typeof division);
        // Try by name
        resolvedDivision = await Division.findOne({ name: String(division) });
          if (!resolvedDivision && mongoose.Types.ObjectId.isValid(division)) {
            resolvedDivision = await Division.findById(division);
          }
          if (!resolvedDivision) {
            resolvedDivision = await Division.findOne({ code: String(division).toUpperCase() });
          }

          if (!resolvedDivision) {
            // Try HRIS cache and create local division if found
            try {
              const hrisDivisions = getCachedDivisions && getCachedDivisions();
              const match = hrisDivisions && hrisDivisions.find(d =>
                String(d.name || d.HIE_NAME_3 || d.hie_name) === String(division) ||
                String(d.HIE_NAME_3) === String(division) ||
                String(d.hie_name) === String(division) ||
                String(d._id) === String(division) ||
                String(d.code) === String(division) ||
                String(d.HIE_CODE) === String(division) ||
                String(d.hie_code) === String(division)
              );

              if (match) {
                const divisionName = match.name || match.HIE_NAME_3 || match.hie_name || `Division ${match._id}`;
                const codeCandidate = String(match.code || match.hie_code || match.HIE_CODE || match._id || divisionName.substring(0, 10).replace(/\s+/g, '_')).toUpperCase();
                resolvedDivision = await Division.findOne({ name: divisionName }) || await Division.findOne({ code: codeCandidate });
                if (!resolvedDivision) {
                  const newDivision = new Division({ name: divisionName, code: codeCandidate, description: match.description || match.hie_name || '' });
                  await newDivision.save();
                  resolvedDivision = newDivision;
                  console.log('Update: created local division from HRIS:', resolvedDivision.name);
                }
              }
            } catch (err) {
              console.error('Update division HRIS lookup error:', err.message || err);
            }
          }

        if (!resolvedDivision && division && division !== '' && division !== 'N/A') {
          // If still unresolved and a value was provided, return helpful error
          console.error('Division could not be resolved:', division);
          return res.status(404).json({ success: false, message: `Division not found: ${division}` });
        }
      } else if (division === '' || division === null) {
        // Explicit clear request
        console.log('Division clear requested');
      }
    }

    // Resolve section when provided (similar to creation flow)
    if (section !== undefined) {
      console.log('Update: resolving section:', section, 'Type:', typeof section);
      if (section && section !== '' && section !== 'N/A') {
          resolvedSection = await Section.findOne({ name: String(section) });
          if (!resolvedSection && mongoose.Types.ObjectId.isValid(section)) {
            resolvedSection = await Section.findById(section);
          }
          if (!resolvedSection) {
            resolvedSection = await Section.findOne({ code: String(section) });
          }

          if (!resolvedSection) {
            try {
              const hrisSections = getCachedSections && getCachedSections();
              const match = hrisSections && hrisSections.find(s =>
                String(s.HIE_NAME_4 || s.hie_name_4) === String(section) ||
                String(s.HIE_NAME || s.hie_name) === String(section) ||
                String(s.name) === String(section) ||
                String(s.HIE_CODE) === String(section) ||
                String(s.HIE_CODE_3) === String(section) ||
                String(s.code) === String(section) ||
                String(s.SECTION_ID) === String(section)
              );

              if (match) {
                const sectionName = match.HIE_NAME_4 || match.hie_name_4 || match.HIE_NAME || match.hie_name || match.name || `Section ${match._id}`;
                const codeCandidate = String(match.HIE_CODE_3 || match.HIE_CODE || match.code || match.SECTION_ID || match.id || sectionName.substring(0, 10).replace(/\s+/g, '_')).toUpperCase();
                let localSection = await Section.findOne({ name: sectionName }) || await Section.findOne({ code: codeCandidate });

                if (!localSection) {
                  // Resolve division for section if possible
                  let sectionDivisionId = null;
                  if (user.division) sectionDivisionId = user.division;
                  else if (match.HIE_RELATIONSHIP) {
                    const possibleDiv = await Division.findOne({ name: match.HIE_RELATIONSHIP });
                    if (possibleDiv) sectionDivisionId = possibleDiv._id;
                  }

                  // Try to create local section if division is available
                  let createdByUserId = req.user ? req.user._id : null;
                  if (!createdByUserId) {
                    const systemAdmin = await User.findOne({ role: 'super_admin' }).select('_id');
                    createdByUserId = systemAdmin ? systemAdmin._id : null;
                  }

                  if (sectionDivisionId && createdByUserId) {
                    localSection = new Section({ name: sectionName, code: codeCandidate || `SEC${String(Math.floor(Math.random() * 9000) + 1000)}`, division: sectionDivisionId, description: match.description || sectionName, createdBy: createdByUserId });
                    await localSection.save();
                    resolvedSection = localSection;
                    console.log('Update: created local section from HRIS:', resolvedSection.name);
                  }
                } else {
                  resolvedSection = localSection;
                }
              }
            } catch (err) {
              console.error('Update section HRIS lookup error:', err.message || err);
            }
          }

        if (!resolvedSection && section && section !== '' && section !== 'N/A') {
          console.error('Section could not be resolved:', section);
          return res.status(404).json({ success: false, message: `Section not found: ${section}` });
        }
      } else if (section === '' || section === null) {
        // Explicit clear request
        console.log('Section clear requested');
      }
    }

    // Now apply the resolved division/section (only if user has permission or no auth)
    const canUpdateRole = !req.user || (req.user && ['super_admin', 'admin'].includes(req.user.role));
    
    if (canUpdateRole) {
      if (role !== undefined) user.role = role;

      // Apply resolved division
      if (division !== undefined) {
        if (resolvedDivision) {
          user.division = resolvedDivision._id;
          user.divisionName = resolvedDivision.name;
          user.divisionCode = resolvedDivision.code;
          console.log('Division applied:', resolvedDivision.name);
        } else if (division === '' || division === null) {
          user.division = undefined;
          user.divisionName = undefined;
          user.divisionCode = undefined;
          console.log('Division cleared');
        }
      }

      // Apply resolved section
      if (section !== undefined) {
        if (resolvedSection) {
          user.section = resolvedSection._id;
          user.sectionName = resolvedSection.name;
          user.sectionCode = resolvedSection.code;
          console.log('Section applied:', resolvedSection.name);
        } else if (section === '' || section === null) {
          user.section = undefined;
          user.sectionName = undefined;
          user.sectionCode = undefined;
          console.log('Section cleared');
        }
      }

      if (isActive !== undefined) user.isActive = isActive;
      
      // Track if permissions were changed
      let permissionsChanged = false;
      if (permissions !== undefined) {
        permissionsChanged = JSON.stringify(oldValues.permissions) !== JSON.stringify(permissions);
        user.permissions = permissions;
      }
    }

    await user.save();

    // Log user update (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'user_updated',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'data_modification',
        severity: 'medium',
        description: 'User updated',
        details: `Updated user: ${user.fullName} (${user.employeeId})`,
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
    }

    // Log to recent activities table (only once - either permissions_updated OR user_updated)
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      if (permissionsChanged) {
        // If permissions were changed, log that specifically
        await logRecentActivity({
          title: 'Permissions Updated',
          description: `Permissions changed for "${user.fullName}"`,
          activity_type: 'permissions_updated',
          entity_id: user._id?.toString(),
          entity_name: user.fullName,
          user_id: req.user?._id?.toString(),
          user_name: req.user?.name || req.user?.username || 'Unknown User'
        });
        console.log(`[MySQL] ✅ Permission change logged for: ${user.fullName}`);
      } else {
        // Otherwise log general user update
        await logRecentActivity({
          title: 'User Updated',
          description: `"${user.fullName}" profile updated`,
          activity_type: 'user_updated',
          icon: 'bi bi-person-check',
          entity_id: user._id?.toString(),
          entity_name: user.fullName,
          user_id: req.user?._id?.toString(),
          user_name: req.user?.name || req.user?.username || 'Unknown User'
        });
        console.log(`[MySQL] ✅ Recent activity logged for user update: ${user.fullName}`);
      }
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log user activity:', activityErr);
    }

    // Populate references before sending response
    await user.populate('division', 'name code');
    await user.populate('section', 'name code');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email or employee ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating user',
      error: process.env.NODE_ENV === 'development' ? (error.message || String(error)) : undefined
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (super_admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion (only if user is authenticated)
    if (req.user && user.id === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Note: Super admin can delete any user including other super admins, except themselves

    await user.destroy();

    // Log user deletion (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        userId: req.user.id,
        action: 'user_deleted',
        entity: { type: 'User', id: user.id, name: user.email },
        category: 'data_modification',
        severity: 'high',
        description: 'User deleted',
        details: `Deleted user: ${user.fullName} (${user.employeeId})`,
        changes: {
          before: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            role: user.role
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
    }

    // Log to recent activities table
    try {
      const { logRecentActivity } = require('../services/activityLogService');

      await logRecentActivity({
        title: 'User Deleted',
        description: `"${user.fullName}" account deleted`,
        activity_type: 'user_deleted',
        icon: 'bi bi-person-x',
        entity_id: user.id?.toString(),
        entity_name: user.fullName,
        user_id: req.user?.id?.toString(),
        user_name: req.user?.name || req.user?.username || 'Unknown User'
      });
    } catch (activityErr) {
      console.error('[RecentActivity] Failed to log user deletion activity:', activityErr);
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user'
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (admin, super_admin)
const getUserStats = async (req, res) => {
  try {
    const { division, section } = req.query;

    let matchQuery = {};

    // Role-based filtering (skip if no user auth)
    if (req.user && req.user.role !== 'super_admin') {
      if (req.user.role === 'admin' && req.user.division) {
        matchQuery.division = req.user.division._id;
      } else if (req.user.role === 'clerk' && req.user.section) {
        matchQuery.section = req.user.section._id;
      }
    }

    // Additional filters
    if (division) matchQuery.division = mongoose.Types.ObjectId(division);
    if (section) matchQuery.section = mongoose.Types.ObjectId(section);

    const stats = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: ['$isActive', 1, 0] }
          },
          inactiveUsers: {
            $sum: { $cond: ['$isActive', 0, 1] }
          },
          roleBreakdown: {
            $push: '$role'
          },
          divisionBreakdown: {
            $push: '$division'
          }
        }
      },
      {
        $project: {
          totalUsers: 1,
          activeUsers: 1,
          inactiveUsers: 1,
          roleStats: {
            $reduce: {
              input: '$roleBreakdown',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $arrayToObject: [
                      [
                        {
                          k: '$$this',
                          v: {
                            $add: [
                              { $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] },
                              1
                            ]
                          }
                        }
                      ]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        roleStats: {}
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user statistics'
    });
  }
};

// @desc    Toggle user status
// @route   PATCH /api/users/:id/toggle-status
// @access  Private (admin, super_admin)
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deactivating super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate super admin user'
      });
    }

    // Prevent self-deactivation (only if user is authenticated)
    if (req.user && user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    const oldStatus = user.isActive;
    user.isActive = !user.isActive;
    await user.save();

    // Log status change (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: user.isActive ? 'user_activated' : 'user_deactivated',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'data_modification',
        severity: 'medium',
        description: `User ${user.isActive ? 'activated' : 'deactivated'}`,
        details: `${user.isActive ? 'Activated' : 'Deactivated'} user: ${user.fullName} (${user.employeeId})`,
        changes: {
          before: { isActive: oldStatus },
          after: { isActive: user.isActive }
        },
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: user.isActive }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling user status'
    });
  }
};

// @desc    Unlock user account
// @route   PATCH /api/users/:id/unlock
// @access  Private (admin, super_admin)
const unlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reset login attempts and unlock
    await user.resetLoginAttempts();

    // Log unlock action (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'user_unlocked',
        entity: { type: 'User', id: user._id, name: user.email },
        category: 'security',
        severity: 'medium',
        description: 'User account unlocked',
        details: `User ${user.fullName} account was unlocked by admin`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });
    }

    res.status(200).json({
      success: true,
      message: 'User account unlocked successfully',
      data: {
        id: user._id,
        isLocked: false
      }
    });

  } catch (error) {
    console.error('Unlock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unlocking user'
    });
  }
};

// @desc    Unlock all users (emergency function)
// @route   POST /api/users/unlock-all
// @access  Private (super_admin only) - No auth required for emergency
const unlockAllUsers = async (req, res) => {
  try {
    // Reset all locked accounts
    const result = await User.updateMany(
      { 
        $or: [
          { lockUntil: { $exists: true } },
          { loginAttempts: { $gt: 0 } }
        ]
      },
      { 
        $unset: { 
          lockUntil: 1,
          loginAttempts: 1 
        }
      }
    );

    // Log unlock all action (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'unlock_all_users',
        entity: { type: 'System' },
        category: 'security',
        severity: 'high',
        description: 'All user accounts unlocked',
        details: `${result.modifiedCount} user accounts were unlocked by super admin`,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          endpoint: req.originalUrl
        },
        isSecurityRelevant: true
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully unlocked ${result.modifiedCount} user accounts`,
      data: {
        unlockedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Unlock all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unlocking users'
    });
  }
};

// @desc    Get all employees from MySQL sync tables (replaces HRIS cache)
// @route   GET /api/users/hris
// @access  Public (for now)
const getHrisEmployees = async (req, res) => {
  try {
    console.log('📥 Fetching employees from MySQL sync tables...');
    
    const { sequelize } = require('../models/mysql');
    const { emp_number, division, section, search, page = 1, limit = 1000 } = req.query;
    
    // Build SQL query with filters
    let whereClause = 'WHERE IS_ACTIVE = 1'; // Only active employees
    const replacements = {};
    
    // Filter by employee number
    if (emp_number) {
      whereClause += ' AND EMP_NO = :emp_number';
      replacements.emp_number = String(emp_number);
    }
    
    // Filter by division
    if (division && division !== 'all') {
      whereClause += ' AND DIV_CODE = :division';
      replacements.division = String(division);
    }
    
    // Filter by section
    if (section && section !== 'all') {
      whereClause += ' AND SEC_CODE = :section';
      replacements.section = String(section);
    }
    
    // Search filter
    if (search) {
      whereClause += ' AND (EMP_NAME LIKE :search OR EMP_NO LIKE :search OR EMP_NIC LIKE :search)';
      replacements.search = `%${search}%`;
    }
    
    // Get total count
    const [[countResult]] = await sequelize.query(
      `SELECT COUNT(*) as total FROM employees_sync ${whereClause}`,
      { replacements }
    );
    const total = countResult?.total || 0;
    
    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    // Fetch employees with pagination
    const [employees] = await sequelize.query(
      `SELECT * FROM employees_sync ${whereClause} ORDER BY EMP_NAME ASC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit: parseInt(limit), offset } }
    );
    
    // Transform to frontend expected format
    const transformedEmployees = employees.map((emp, index) => ({
      _id: `mysql_emp_${emp.EMP_NO}`,
      EMP_NUMBER: emp.EMP_NO,
      FULLNAME: emp.EMP_NAME,
      CALLING_NAME: emp.EMP_FIRST_NAME || emp.EMP_NAME,
      DESIGNATION: emp.EMP_DESIGNATION,
      GENDER: emp.EMP_GENDER || 'N/A',
      NIC: emp.EMP_NIC || 'N/A',
      DATE_OF_BIRTH: emp.EMP_DATE_OF_BIRTH || null,
      DATE_OF_JOINING: emp.EMP_DATE_JOINED,
      SECTION_CODE: emp.SEC_CODE,
      SECTION_NAME: emp.SEC_NAME,
      DIVISION_CODE: emp.DIV_CODE,
      DIVISION_NAME: emp.DIV_NAME,
      STATUS: emp.IS_ACTIVE ? 'ACTIVE' : 'INACTIVE',
      EMP_STATUS: emp.EMP_STATUS,
      EMP_TYPE: emp.EMP_TYPE,
      EMP_GRADE: emp.EMP_GRADE,
      EMP_EMAIL: emp.EMP_EMAIL,
      EMP_PHONE: emp.EMP_PHONE,
      EMP_MOBILE: emp.EMP_MOBILE,
      LOCATION: emp.LOCATION,
      source: 'MySQL'
    }));

    console.log(`✅ Successfully fetched ${transformedEmployees.length} employees from MySQL (total: ${total})`);
    
    res.status(200).json({
      success: true,
      message: 'Employees fetched from MySQL sync tables',
      data: transformedEmployees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      source: 'MySQL'
    });
    
  } catch (error) {
    console.error('❌ Get employees from MySQL error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees from MySQL',
      error: error.message
    });
  }
};


module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  toggleUserStatus,
  unlockUser,
  unlockAllUsers,
  getHrisEmployees
};
