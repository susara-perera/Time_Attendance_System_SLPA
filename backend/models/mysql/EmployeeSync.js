const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmployeeSync = sequelize.define('EmployeeSync', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    EMP_NO: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Employee number from HRIS'
    },
    EMP_NAME: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Employee full name'
    },
    EMP_NAME_WITH_INITIALS: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Employee name with initials'
    },
    EMP_FIRST_NAME: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'First name'
    },
    EMP_LAST_NAME: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Last name'
    },
    EMP_NIC: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'National ID number'
    },
    EMP_EMAIL: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email address'
    },
    EMP_PHONE: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Phone number'
    },
    EMP_MOBILE: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Mobile number'
    },
    EMP_ADDRESS: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Address'
    },
    // Employment details
    EMP_STATUS: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Employment status'
    },
    EMP_TYPE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Employment type'
    },
    EMP_DESIGNATION: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Job designation'
    },
    EMP_GRADE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Employee grade'
    },
    EMP_DATE_JOINED: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date joined'
    },
    EMP_DATE_PERMANENT: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Permanent date'
    },
    EMP_DATE_RETIRE: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Retirement date'
    },
    // Organizational assignment
    DIV_CODE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Division code'
    },
    DIV_NAME: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Division name'
    },
    SEC_CODE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Section code'
    },
    SEC_NAME: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Section name'
    },
    DEPT_CODE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Department code'
    },
    DEPT_NAME: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Department name'
    },
    // Additional HRIS fields
    HIE_CODE: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Hierarchy code'
    },
    HIE_NAME: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Hierarchy name'
    },
    LOCATION: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Work location'
    },
    COST_CENTER: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Cost center'
    },
    // Status
    STATUS: {
      type: DataTypes.STRING(20),
      defaultValue: 'ACTIVE',
      comment: 'Active status'
    },
    IS_ACTIVE: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Is employee active'
    },
    // Sync metadata
    synced_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Last sync timestamp'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'employees_sync',
    timestamps: false,
    indexes: [
      { fields: ['EMP_NO'], unique: true },
      { fields: ['EMP_NAME'] },
      { fields: ['EMP_NIC'] },
      { fields: ['DIV_CODE'] },
      { fields: ['SEC_CODE'] },
      { fields: ['EMP_STATUS'] },
      { fields: ['synced_at'] },
      { fields: ['STATUS'] }
    ]
  });

  return EmployeeSync;
};
