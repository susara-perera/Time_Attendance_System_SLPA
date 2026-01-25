const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/mysql");
const bcrypt = require("bcryptjs");

const MySQLUser = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  employeeId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM("super_admin", "admin", "clerk", "administrative_clerk", "employee"),
    defaultValue: "employee"
  },
  divisionId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  divisionCode: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  divisionName: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  sectionId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  sectionCode: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  sectionName: {
    type: DataTypes.STRING(150),
    allowNull: true
  },
  subsectionId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  subsectionCode: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  subsectionName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING(15),
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  permissions: {
    type: DataTypes.TEXT, // Using TEXT as it is longtext in DB
    allowNull: true,
    get() {
      const rawValue = this.getDataValue("permissions");
      try {
        return rawValue ? JSON.parse(rawValue) : null;
      } catch (e) {
        return rawValue;
      }
    },
    set(value) {
      this.setDataValue("permissions", typeof value === "object" ? JSON.stringify(value) : value);
    }
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "users", // lowercase to match DB
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed("password")) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

MySQLUser.prototype.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Backwards-compatible alias for legacy code expecting `comparePassword`
MySQLUser.prototype.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

MySQLUser.prototype.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

MySQLUser.prototype.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Define associations method
MySQLUser.associate = function(models) {
  // User belongs to Division
  MySQLUser.belongsTo(models.MySQLDivision, {
    foreignKey: 'divisionId',
    as: 'division'
  });
  
  // User belongs to Section
  MySQLUser.belongsTo(models.MySQLSection, {
    foreignKey: 'sectionId',
    as: 'section'
  });
  
  // User belongs to SubSection
  MySQLUser.belongsTo(models.MySQLSubSection, {
    foreignKey: 'subsectionId',
    as: 'subsection'
  });
};

module.exports = MySQLUser;
