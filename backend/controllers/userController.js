const User = require('../models/User');
const Division = require('../models/Division');
const Section = require('../models/Section');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');
const { 
  readData, 
  getCachedOrFetch, 
  getCachedEmployees,
  getCachedDivisions,
  getCachedSections,
  isCacheInitialized,
  initializeCache 
} = require('../services/hrisApiService');

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

    // Build query
    let query = {};

    // Role-based filtering (skip if no user auth)
    if (req.user && req.user.role !== 'super_admin') {
      if (req.user.role === 'admin' && req.user.division) {
        query.division = req.user.division._id;
      } else if (req.user.role === 'clerk' && req.user.section) {
        query.section = req.user.section._id;
      }
    }

    // Additional filters
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (division) query.division = division;
    if (section) query.section = section;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Sort order
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj = { [sort]: sortOrder };

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .populate('division', 'name code')
        .populate('section', 'name code')
        .sort(sortObj)
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
      data: users,
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
    const user = await User.findById(req.params.id)
      .populate('division', 'name code workingHours')
      .populate('section', 'name code');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check access permissions (skip if no user auth)
    if (req.user && req.user.role !== 'super_admin' && 
        req.user.role !== 'admin' && 
        req.user._id.toString() !== user._id.toString()) {
      
      // Clerks can only view users in their section
      if (req.user.role === 'clerk') {
        if (!req.user.section || !user.section || 
            req.user.section._id.toString() !== user.section._id.toString()) {
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

    // Validate role against stored roles
    const Role = require('../models/Role');
    const roleExists = await Role.findOne({ value: role });
    if (!roleExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
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
      $or: [{ email }, { employeeId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

    // Validate division exists
    if (division) {
      const divisionExists = await Division.findById(division);
      if (!divisionExists) {
        return res.status(400).json({
          success: false,
          message: 'Division not found'
        });
      }
    }

    // Validate section exists and belongs to division
    if (section) {
      const sectionExists = await Section.findById(section);
      if (!sectionExists) {
        return res.status(400).json({
          success: false,
          message: 'Section not found'
        });
      }
      
      if (division && sectionExists.division.toString() !== division) {
        return res.status(400).json({
          success: false,
          message: 'Section does not belong to the specified division'
        });
      }
    }

    // Set default permissions based on role
    let userPermissions = permissions || {};
    
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

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      employeeId,
      password,
      role,
      division,
      section,
      phone,
      address,
      designation,
      salary,
      permissions: userPermissions
    });

    await user.save();

    // Log user creation (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'user_created',
        entity: { type: 'User', id: user._id, name: user.email },
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

    // Populate references before sending response
    await user.populate('division', 'name code');
    await user.populate('section', 'name code');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

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

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (designation !== undefined) user.designation = designation;
    if (salary !== undefined) user.salary = salary;

    // Only super_admin and admin can change these fields (skip if no user auth)
    if (req.user && ['super_admin', 'admin'].includes(req.user.role)) {
      if (role !== undefined) user.role = role;
      if (division !== undefined) user.division = division;
      if (section !== undefined) user.section = section;
      if (isActive !== undefined) user.isActive = isActive;
      if (permissions !== undefined) user.permissions = permissions;
    } else if (!req.user) {
      // Allow all updates when no authentication (testing mode)
      if (role !== undefined) user.role = role;
      if (division !== undefined) user.division = division;
      if (section !== undefined) user.section = section;
      if (isActive !== undefined) user.isActive = isActive;
      if (permissions !== undefined) user.permissions = permissions;
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
      message: 'Server error updating user'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (super_admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete super admin user'
      });
    }

    // Prevent self-deletion (only if user is authenticated)
    if (req.user && user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    // Log user deletion (only if user is authenticated)
    if (req.user) {
      await AuditLog.createLog({
        user: req.user._id,
        action: 'user_deleted',
        entity: { type: 'User', id: user._id, name: user.email },
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

// @desc    Get all employees from HRIS API
// @route   GET /api/users/hris
// @access  Public (for now)
const getHrisEmployees = async (req, res) => {
  try {
    console.log('📥 Fetching employees from HRIS (using cache)...');
    
    // Ensure cache is initialized
    if (!isCacheInitialized()) {
      console.log('🔄 Cache not initialized, initializing now...');
      await initializeCache();
    }
    
    const { emp_number, division, section } = req.query;
    
    // Get employees from cache
    let allEmployees = getCachedEmployees();
    
    // If not in cache, fetch and cache
    if (!allEmployees) {
      console.log('⚠️ Employees not in cache, fetching from API...');
      allEmployees = await getCachedOrFetch('employee', {});
    }
    
    // Get hierarchy data from cache for division and section mapping
    const allHierarchy = await getCachedOrFetch('company_hierarchy', {});
    const divisions = allHierarchy.filter(item => item.DEF_LEVEL === 3 || item.DEF_LEVEL === '3');
    const sections = allHierarchy.filter(item => item.DEF_LEVEL === 4 || item.DEF_LEVEL === '4');
    
    // Create mappings
    const divisionMap = {};
    const sectionMap = {};
    
    divisions.forEach(div => {
      divisionMap[div.HIE_CODE] = div.HIE_NAME;
    });
    
    sections.forEach(sec => {
      sectionMap[sec.HIE_CODE] = {
        name: sec.HIE_NAME,
        division_code: sec.HIE_RELATIONSHIP
      };
    });

    // Transform and filter employees
    let employees = allEmployees;
    
    // Apply emp_number filter if provided
    if (emp_number) {
      const empNumbers = Array.isArray(emp_number) ? emp_number.map(Number) : [Number(emp_number)];
      employees = employees.filter(emp => empNumbers.includes(emp.EMP_NUMBER));
    }
    
    // Transform employees data to include division and section info
    const transformedEmployees = employees.map((employee, index) => {
      // Employee division and section codes come from HIE_CODE_2 and HIE_CODE_3
      const divisionCode = employee.HIE_CODE_2;
      const sectionCode = employee.HIE_CODE_3;
      
      // Get division and section names from hierarchy mapping
      const divisionName = divisionMap[divisionCode] || 
        employee.currentwork?.HIE_NAME_2 || 
        `Division ${divisionCode}`;
      
      const sectionInfo = sectionMap[sectionCode] || {};
      const sectionName = sectionInfo.name || 
        employee.currentwork?.HIE_NAME_3 || 
        `Section ${sectionCode}`;
      
      return {
        _id: employee._id || `hris_emp_${index}`,
        EMP_NUMBER: employee.EMP_NUMBER,
        FULLNAME: employee.FULLNAME,
        CALLING_NAME: employee.CALLING_NAME,
        DESIGNATION: employee.currentwork?.designation,
        GENDER: employee.GENDER,
        NIC: employee.NIC,
        DATE_OF_BIRTH: employee.BIRTHDAY,
        DATE_OF_JOINING: employee.DATE_JOINED,
        SECTION_CODE: sectionCode,
        SECTION_NAME: sectionName,
        DIVISION_CODE: divisionCode,
        DIVISION_NAME: divisionName,
        STATUS: employee.ACTIVE_HRM_FLG === 1 ? 'ACTIVE' : 'INACTIVE',
        currentwork: employee.currentwork
      };
    });

    // Apply division filter if provided
    if (division && division !== 'all') {
      employees = transformedEmployees.filter(emp => 
        String(emp.DIVISION_CODE) === String(division)
      );
    } else {
      employees = transformedEmployees;
    }

    // Apply section filter if provided
    if (section && section !== 'all') {
      employees = employees.filter(emp => 
        String(emp.SECTION_CODE) === String(section)
      );
    }

    console.log(`Successfully fetched ${employees.length} employees from HRIS`);
    
    res.status(200).json({
      success: true,
      message: 'HRIS employees fetched successfully',
      data: employees,
      pagination: {
        page: 1,
        limit: employees.length,
        total: employees.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  } catch (error) {
    console.error('Get HRIS employees error:', error.message);
    console.error('Falling back to local employees...');
    
    try {
      // Fallback to local employees
      const User = require('../models/User');
      const localEmployees = await User.find({ isActive: true })
        .populate('division', 'name code')
        .populate('section', 'name code')
        .sort({ firstName: 1, lastName: 1 });

      const transformedLocalEmployees = localEmployees.map((employee, index) => ({
        _id: employee._id,
        EMP_NUMBER: employee.employeeId,
        FULLNAME: `${employee.firstName} ${employee.lastName}`,
        CALLING_NAME: employee.firstName,
        DESIGNATION: employee.role,
        GENDER: employee.gender || 'N/A',
        NIC: employee.nic || 'N/A',
        DATE_OF_BIRTH: employee.dateOfBirth?.toISOString() || null,
        DATE_OF_JOINING: employee.dateOfJoining?.toISOString() || null,
        SECTION_CODE: employee.section?.code || 'N/A',
        SECTION_NAME: employee.section?.name || 'No Section',
        DIVISION_CODE: employee.division?.code || 'N/A',
        DIVISION_NAME: employee.division?.name || 'No Division',
        STATUS: employee.isActive ? 'ACTIVE' : 'INACTIVE',
        source: 'LOCAL_FALLBACK'
      }));

      console.log(`Fallback: returning ${transformedLocalEmployees.length} local employees`);

      res.status(200).json({
        success: true,
        message: 'HRIS API unavailable. Showing local employees as fallback.',
        data: transformedLocalEmployees,
        pagination: {
          page: 1,
          limit: transformedLocalEmployees.length,
          total: transformedLocalEmployees.length,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        },
        fallback: true,
        originalError: 'HRIS API connection failed'
      });
    } catch (fallbackError) {
      console.error('Fallback to local employees also failed:', fallbackError);
      res.status(500).json({
        success: false,
        message: 'Both HRIS API and local database are unavailable',
        error: error.message
      });
    }
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
