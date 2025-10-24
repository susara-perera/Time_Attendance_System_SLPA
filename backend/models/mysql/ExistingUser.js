const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');
const bcrypt = require('bcryptjs');

// MySQL User model based on your existing table structure
const MySQLUser = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  division: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  employee_ID: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'employee_ID' // Map to the actual column name
  },
  pwd: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: false, // Your existing table doesn't have timestamps
  indexes: [
    { fields: ['employee_ID'] }
  ]
});

// Compare password method for existing hashed passwords
MySQLUser.prototype.comparePassword = async function(candidatePassword) {
  // First try bcrypt compare (for PHP password_hash)
  try {
    return await bcrypt.compare(candidatePassword, this.pwd);
  } catch (error) {
    // If bcrypt fails, try simple string comparison (for testing)
    return candidatePassword === this.pwd;
  }
};

// Remove password from JSON output
MySQLUser.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.pwd;
  return values;
};

module.exports = MySQLUser;
