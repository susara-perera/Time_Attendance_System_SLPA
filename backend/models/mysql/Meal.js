const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/mysql');

const MySQLMeal = sequelize.define('Meal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  mealType: {
    type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
    allowNull: false,
    defaultValue: 'lunch'
  },
  menuItem: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('ordered', 'confirmed', 'served', 'cancelled', 'paid'),
    defaultValue: 'ordered'
  },
  orderTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  servedTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'meals',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['date'] },
    { fields: ['mealType'] },
    { fields: ['status'] },
    { fields: ['userId', 'date'] }
  ]
});

module.exports = MySQLMeal;
