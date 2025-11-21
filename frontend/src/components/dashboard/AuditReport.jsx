import React from 'react';
import './GroupReport.css'; // Reuse same styling

const AuditReport = ({ reportData }) => {
  if (!reportData || !reportData.data || reportData.data.length === 0) {
    return (
      <div className="no-data-message">
        <p>No audit records found for the selected criteria.</p>
      </div>
    );
  }

  const { dateRange, summary } = reportData;

  return (
    <div className="report-container">
      <div className="report-header">
        <h2>Audit Report - Single Punch Employees</h2>
        <div className="report-info">
          <p><strong>Date Range:</strong> {dateRange.from} to {dateRange.to}</p>
          <p><strong>Division:</strong> {summary.divisionFilter}</p>
          <p><strong>Section:</strong> {summary.sectionFilter}</p>
          <p><strong>Total Employees:</strong> {summary.totalEmployees}</p>
          <p><strong>Total Records:</strong> {summary.totalRecords}</p>
        </div>
      </div>

      <div className="report-content">
        {reportData.data.map((designationGroup, groupIndex) => (
          <div key={groupIndex} className="designation-group">
            <div className="designation-header">
              <h3>{designationGroup.designation}</h3>
              <span className="employee-count">({designationGroup.count} records)</span>
            </div>
            
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Division</th>
                  <th>Section</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Scan Type</th>
                </tr>
              </thead>
              <tbody>
                {designationGroup.employees.map((employee, empIndex) => (
                  <tr key={empIndex}>
                    <td>{employee.employeeId}</td>
                    <td>{employee.employeeName}</td>
                    <td>{employee.divisionName}</td>
                    <td>{employee.sectionName}</td>
                    <td>{employee.date}</td>
                    <td>{employee.time}</td>
                    <td>{employee.scanType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="report-footer">
        <p>Generated on {new Date().toLocaleString()}</p>
        <p className="audit-note">
          Note: This report shows employees who have only one punch record per day.
        </p>
      </div>
    </div>
  );
};

export default AuditReport;
