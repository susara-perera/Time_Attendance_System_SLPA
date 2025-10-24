const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');
const bcrypt = require('bcryptjs');

const MySQLUser = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 50]
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  employeeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 20]
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin', 'clerk', 'administrative_clerk', 'employee'),
    defaultValue: 'employee'
  },
  divisionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Divisions',
      key: 'id'
    }
  },
  sectionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Sections',
      key: 'id'
    }
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dateOfJoining: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0
    }
  },
  designation: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: {
      users: { create: false, read: false, update: false, delete: false },
      attendance: { create: false, read: false, update: false, delete: false },
      reports: { create: false, read: false, update: false, delete: false },
      divisions: { create: false, read: false, update: false, delete: false },
      settings: { create: false, read: false, update: false, delete: false }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  profilePicture: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['employeeId'] },
    { fields: ['divisionId'] },
    { fields: ['role'] }
  ]
});

// Virtual for full name
MySQLUser.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Check if account is locked
MySQLUser.prototype.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Increment login attempts
MySQLUser.prototype.incLoginAttempts = async function() {
  // If previous lock has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return await this.update({
      lockUntil: null,
      loginAttempts: 1
    });
  }
  
  const updates = { loginAttempts: this.loginAttempts + 1 };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  }
  
  return await this.update(updates);
};

// Reset login attempts
MySQLUser.prototype.resetLoginAttempts = async function() {
  return await this.update({
    loginAttempts: 0,
    lockUntil: null
  });
};

// Compare password method
MySQLUser.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Hash password before saving
MySQLUser.beforeSave(async (user, options) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Remove password from JSON output
MySQLUser.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.passwordResetToken;
  delete values.passwordResetExpires;
  delete values.loginAttempts;
  delete values.lockUntil;
  return values;
};

module.exports = MySQLUser;
