const { MySQLUser: User, MySQLDivision: Division, MySQLSection: Section, MySQLSubSection: SubSection } = require("../models/mysql");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/mysql");

// Helper function to recreate users table if needed
const ensureUsersTable = async () => {
  try {
    // Check if users table exists and recreate if needed
    const [results] = await sequelize.query("SHOW TABLES LIKE 'users'");
    
    if (results.length === 0) {
      console.log('Users table not found, creating...');
      await User.sync({ force: true });
      console.log('Users table created successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring users table:', error);
    throw error;
  }
};

// @desc    Get all users 
// @route   GET /api/users
const getUsers = async (req, res) => {
  try {
    await ensureUsersTable();
    
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['firstName', 'ASC'], ['lastName', 'ASC']]
    });

    res.status(200).json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id  
const getUser = async (req, res) => {
  try {
    await ensureUsersTable();
    
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// @desc    Create user
// @route   POST /api/users
const createUser = async (req, res) => {
  try {
    await ensureUsersTable();
    
    const {
      firstName,
      lastName,
      email,
      employeeId,
      password,
      role = 'employee',
      phone,
      division,
      section,
      subsection,
      isActive = true
    } = req.body;

    console.log('📥 Create user request body:', {
      firstName, lastName, email, employeeId, role, phone,
      division, section, subsection,
      divisionType: typeof division,
      sectionType: typeof section,
      divisionKeys: division ? Object.keys(division) : 'null',
      sectionKeys: section ? Object.keys(section) : 'null'
    });

    // Validate required fields
    if (!firstName || !lastName || !email || !employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, employeeId, password'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { employeeId: employeeId }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

    // Extract division data (ID, code, name) from the division object
    let divisionData = { id: null, code: null, name: null };
    if (division) {
      if (typeof division === 'object' && division !== null) {
        divisionData.id = division.id || division._id;
        divisionData.code = division.code || division.HIE_CODE || division.div_code;
        divisionData.name = division.name || division.HIE_NAME || division.div_name;
        console.log('📝 Extracted from division object:', divisionData);
      } else {
        divisionData.id = division;
        console.log('📝 Division is primitive:', division);
      }
    } else {
      console.log('📝 No division provided');
    }
    console.log('📝 Final division data:', divisionData);

    // Extract section data (ID, code, name) from the section object
    let sectionData = { id: null, code: null, name: null };
    if (section) {
      if (typeof section === 'object' && section !== null) {
        sectionData.id = section.id || section._id;
        sectionData.code = section.code || section.HIE_CODE || section.sec_code;
        sectionData.name = section.name || section.HIE_NAME || section.sec_name;
        console.log('📝 Extracted from section object:', sectionData);
      } else {
        sectionData.id = section;
        console.log('📝 Section is primitive:', section);
      }
    } else {
      console.log('📝 No section provided');
    }
    console.log('📝 Final section data:', sectionData);

    // Extract subsection data (ID, code, name) from the subsection object
    let subsectionData = { id: null, code: null, name: null };
    if (subsection) {
      if (typeof subsection === 'object' && subsection !== null) {
        subsectionData.id = subsection.id || subsection._id;
        subsectionData.code = subsection.code || subsection.sub_code;
        subsectionData.name = subsection.name || subsection.sub_name;
      } else {
        subsectionData.id = subsection;
      }
    }
    console.log('📝 Final subsection data:', subsectionData);

    // Create new user with denormalized division/section/subsection data
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      employeeId,
      password, // Will be hashed by the model hook
      role,
      phone,
      divisionId: divisionData.id,
      divisionCode: divisionData.code,
      divisionName: divisionData.name,
      sectionId: sectionData.id,
      sectionCode: sectionData.code,
      sectionName: sectionData.name,
      subsectionId: subsectionData.id,
      subsectionCode: subsectionData.code,
      subsectionName: subsectionData.name,
      isActive
    });

    // Return user without password
    const userResponse = newUser.toJSON();
    delete userResponse.password;

    console.log('✅ User created:', {
      id: userResponse.id,
      email: userResponse.email,
      divisionName: userResponse.divisionName,
      sectionName: userResponse.sectionName
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    await ensureUsersTable();
    
    const userId = req.params.id;
    const {
      firstName,
      lastName,
      email,
      employeeId,
      password,
      role,
      phone,
      division,
      section,
      subsection,
      isActive
    } = req.body;

    // Find the user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email or employeeId is being changed and if it already exists
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email, id: { [Op.ne]: userId } } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    if (employeeId && employeeId !== user.employeeId) {
      const existingEmployeeId = await User.findOne({ where: { employeeId, id: { [Op.ne]: userId } } });
      if (existingEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists'
        });
      }
    }

    // Extract division data (ID, code, name) from the division object
    let divisionData = { id: null, code: null, name: null };
    if (division) {
      if (typeof division === 'object') {
        divisionData.id = division.id || division._id;
        divisionData.code = division.code || division.HIE_CODE || division.div_code;
        divisionData.name = division.name || division.HIE_NAME || division.div_name;
      } else {
        divisionData.id = division;
      }
    }

    // Extract section data (ID, code, name) from the section object
    let sectionData = { id: null, code: null, name: null };
    if (section) {
      if (typeof section === 'object') {
        sectionData.id = section.id || section._id;
        sectionData.code = section.code || section.HIE_CODE || section.sec_code;
        sectionData.name = section.name || section.HIE_NAME || section.sec_name;
      } else {
        sectionData.id = section;
      }
    }

    // Extract subsection data (ID, code, name) from the subsection object
    let subsectionData = { id: null, code: null, name: null };
    if (subsection) {
      if (typeof subsection === 'object') {
        subsectionData.id = subsection.id || subsection._id;
        subsectionData.code = subsection.code || subsection.sub_code;
        subsectionData.name = subsection.name || subsection.sub_name;
      } else {
        subsectionData.id = subsection;
      }
    }

    // Build update object
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (employeeId !== undefined) updateData.employeeId = employeeId;
    if (role !== undefined) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (divisionData.id !== null) {
      updateData.divisionId = divisionData.id;
      updateData.divisionCode = divisionData.code;
      updateData.divisionName = divisionData.name;
    }
    if (sectionData.id !== null) {
      updateData.sectionId = sectionData.id;
      updateData.sectionCode = sectionData.code;
      updateData.sectionName = sectionData.name;
    }
    if (subsectionData.id !== null) {
      updateData.subsectionId = subsectionData.id;
      updateData.subsectionCode = subsectionData.code;
      updateData.subsectionName = subsectionData.name;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Handle password update separately if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Update the user
    await user.update(updateData);

    // Fetch updated user without password
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });

    res.status(200).json({
      success: true,
      user: updatedUser,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path;
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    await ensureUsersTable();
    
    const userId = req.params.id;

    // Find the user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of the last super_admin
    if (user.role === 'super_admin') {
      const superAdminCount = await User.count({ where: { role: 'super_admin' } });
      if (superAdminCount === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last super admin user'
        });
      }
    }

    // Delete the user
    await user.destroy();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { id: userId }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
};
