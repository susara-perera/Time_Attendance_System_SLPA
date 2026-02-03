import React, { useState, useEffect } from 'react';
import './GroupReport.css'; // Reuse same styling

const AuditReport = ({ reportData }) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  // Auto-expand all groups on load
  useEffect(() => {
    if (reportData && reportData.data) {
      const allExpanded = {};
      reportData.data.forEach((_, index) => {
        allExpanded[index] = true;
      });
      setExpandedGroups(allExpanded);
    }
  }, [reportData]);

  // Helper: format date to DD-MMM-YY (e.g., 26-Jan-26)
  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g, '-');
  }; 

  if (!reportData || !reportData.data || reportData.data.length === 0) {
    return (
      <div className="no-data-message">
        <p>No audit records found for the selected criteria.</p>
      </div>
    );
  }

  const { dateRange = {}, summary = {}, grouping = 'none' } = reportData;

  const toggleGroup = (groupIndex) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupIndex]: !prev[groupIndex]
    }));
  };

  return (
    <div className="report-container" style={{ background: '#ffffff' }}>
      {/* Print Styles - Optimized for full details with cost-effective pagination */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
          }
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          .page-break { page-break-after: always; }
          .avoid-break { page-break-inside: avoid; }
          .print-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #000;
          }
          .group-section {
            margin-bottom: 20px;
          }
          .group-header {
            background-color: #e0e0e0 !important;
            padding: 8px !important;
            font-weight: bold;
            border: 1px solid #000;
            margin-top: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          th, td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5 !important;
            font-weight: bold;
          }
          /* Fit more rows per page */
          tr {
            line-height: 1.2;
          }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Print Content - Full details with proper pagination */}
      <div className="print-only print-content">
        <div className="print-header">
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
            {grouping === 'designation' ? 'SLPA DESIGNATION WISE AUDIT REPORT' : 
             grouping === 'punch' ? 'SLPA PUNCH TYPE AUDIT REPORT' : 
             'SLPA AUDIT REPORT'}
          </h1>
          <div style={{ fontSize: '11px', color: '#000', marginTop: '8px' }}>
            <strong>Division:</strong> {summary.divisionFilter || 'All'} | 
            <strong> Section:</strong> {summary.sectionFilter || 'All'}
            {summary.subSectionFilter && summary.subSectionFilter !== 'All' && (
              <> | <strong>Sub Section:</strong> {summary.subSectionFilter}</>
            )}
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
            Total Employees: {summary.totalEmployees || 0} | 
            Total Groups: {summary.totalGroups || 0} | 
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
        
        {/* Print Data Tables - Each group with all details */}
        {reportData.data.map((group, groupIndex) => (
          <div key={groupIndex} className="group-section">
            <div className="group-header" style={{ backgroundColor: '#e0e0e0', padding: '8px', fontWeight: 'bold', border: '1px solid #000', marginTop: '10px', fontSize: '12px' }}>
              {group.groupName} - {group.count} Employee{group.count !== 1 ? 's' : ''}
            </div>
            {/* Conditional table: Punch-wise (5 cols) vs Designation-wise (4 cols) */}
            {(group.employees || []).length > 0 && group.employees[0]?.eventDate ? (
              // Punch-wise grouping table with Date and Time
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '5px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '15%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Employee ID</th>
                    <th style={{ width: '30%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Employee Name</th>
                    <th style={{ width: '25%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Designation</th>
                    <th style={{ width: '15%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Date</th>
                    <th style={{ width: '15%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.employees || []).map((emp, empIndex) => (
                    <tr key={empIndex} className={empIndex % 30 === 29 ? 'avoid-break' : ''}>
                      <td style={{ padding: '6px', border: '1px solid #000', fontFamily: 'monospace' }}>{emp.employeeId}</td>
                      <td style={{ padding: '6px', border: '1px solid #000' }}>{emp.employeeName}</td>
                      <td style={{ padding: '6px', border: '1px solid #000' }}>{emp.designation}</td>
                      <td style={{ padding: '6px', border: '1px solid #000' }}>{formatDate(emp.eventDate)}</td>
                      <td style={{ padding: '6px', border: '1px solid #000', fontFamily: 'monospace' }}>{emp.eventTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // Designation-wise grouping table (original 4 columns)
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '5px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '12%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Employee ID</th>
                    <th style={{ width: '38%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Employee Name</th>
                    <th style={{ width: '35%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>Designation</th>
                    <th style={{ width: '15%', padding: '6px', border: '1px solid #000', backgroundColor: '#f5f5f5', fontWeight: 'bold', textAlign: 'center' }}>Division</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.employees || []).map((emp, empIndex) => (
                    <tr key={empIndex} className={empIndex % 30 === 29 ? 'avoid-break' : ''}>
                      <td style={{ padding: '6px', border: '1px solid #000', fontFamily: 'monospace' }}>{emp.employeeId}</td>
                      <td style={{ padding: '6px', border: '1px solid #000' }}>{emp.employeeName}</td>
                      <td style={{ padding: '6px', border: '1px solid #000' }}>{emp.designation}</td>
                      <td style={{ padding: '6px', border: '1px solid #000', fontSize: '9px' }}>{emp.divisionName || summary.divisionFilter || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Add page break after every 2 groups to optimize pages */}
            {groupIndex > 0 && (groupIndex + 1) % 2 === 0 && groupIndex < reportData.data.length - 1 && (
              <div className="page-break"></div>
            )}
          </div>
        ))}
        
        {/* Footer on last page */}
        <div style={{ marginTop: '30px', paddingTop: '10px', borderTop: '1px solid #999', fontSize: '9px', textAlign: 'center', color: '#666' }}>
          <p style={{ margin: '5px 0' }}>
            This is a computer-generated report from SLPA Time & Attendance System
          </p>
          <p style={{ margin: '5px 0' }}>
            Page count optimized for cost-effective printing | Report Date: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Screen Header - Simple Title */}
      <div className="screen-only" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 24px',
        borderRadius: '8px 8px 0 0'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          {grouping === 'designation' ? 'SLPA Designation Wise Audit Report' : 
           grouping === 'punch' ? 'SLPA Punch Type Audit Report' : 
           'SLPA Audit Report'}
        </h2>
        <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
          {dateRange.from && dateRange.from !== 'N/A' ? `${dateRange.from} to ${dateRange.to}` : 'All Employees'}
        </p>
      </div>

      {/* Summary Cards - Screen Only */}
      <div className="screen-only" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        padding: '24px',
        background: '#f8f9fa'
      }}>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '4px' }}>Total Issues</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>{summary.totalRecords || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '4px' }}>Affected Employees</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fd7e14' }}>{summary.totalEmployees || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '4px' }}>Report Groups</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0dcaf0' }}>{summary.totalGroups || 0}</div>
        </div>
        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '4px' }}>Grouping Method</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6610f2', textTransform: 'capitalize' }}>
            {summary.groupingMethod || 'None'}
          </div>
        </div>
      </div>

      {/* Filter Information - Screen Only */}
      <div className="screen-only" style={{ padding: '16px 24px', background: '#e9ecef', borderTop: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '14px' }}>
          <div><strong>Division:</strong> {summary.divisionFilter || 'All'}</div>
          <div><strong>Section:</strong> {summary.sectionFilter || 'All'}</div>
          <div><strong>Sub Section:</strong> {summary.subSectionFilter || 'All'}</div>
          <div><strong>Time Period:</strong> {summary.timePeriod || 'Custom'}</div>
        </div>
      </div>

      {/* Detailed Records by Group */}
      <div className="report-content" style={{ padding: '24px' }}>
        <h3 className="screen-only" style={{ marginBottom: '16px', color: '#495057' }}>
          <i className="bi bi-table"></i> {grouping === 'designation' ? 'Employees by Designation' : 
                                            grouping === 'punch' ? 'Attendance Records by Punch Type' : 
                                            'Detailed Audit Records'}
        </h3>
        
        {reportData.data.map((group, groupIndex) => (
          <div key={groupIndex} style={{ 
            marginBottom: '24px', 
            border: '1px solid #dee2e6', 
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div 
              onClick={() => toggleGroup(groupIndex)}
              style={{ 
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white',
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                  {group.groupName}
                </h4>
                <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                  {group.count} {grouping === 'designation' ? 'employees' : 'records'} | {group.totalIssues || group.count} total issues
                </div>
              </div>
              <div style={{ fontSize: '20px' }}>
                {expandedGroups[groupIndex] ? '▼' : '▶'}
              </div>
            </div>
            
            {expandedGroups[groupIndex] && (
              <div style={{ background: 'white' }}>
                {grouping === 'designation' ? (
                  // Simplified table for designation-wise (Employee ID, Name, Designation only)
                  <table className="audit-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '20%' }}>Employee ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '50%' }}>Employee Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '30%' }}>Designation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.employees || []).map((emp, empIndex) => (
                        <tr key={empIndex}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', border: '1px solid #000' }}>{emp.employeeId}</td>
                          <td style={{ padding: '12px', fontWeight: '500', border: '1px solid #000' }}>{emp.employeeName}</td>
                          <td style={{ padding: '12px', border: '1px solid #000' }}>{emp.designation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : grouping === 'punch' ? (
                  // Professional audit table for punch-wise (ID, Name, Designation, Date, Time)
                  <table className="audit-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '15%' }}>Employee ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '30%' }}>Employee Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '25%' }}>Designation</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '15%' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #000', width: '15%' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.employees || []).map((emp, empIndex) => (
                        <tr key={empIndex}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', border: '1px solid #000' }}>{emp.employeeId}</td>
                          <td style={{ padding: '12px', fontWeight: '500', border: '1px solid #000' }}>{emp.employeeName}</td>
                          <td style={{ padding: '12px', border: '1px solid #000' }}>{emp.designation}</td>
                          <td style={{ padding: '12px', border: '1px solid #000' }}>{formatDate(emp.eventDate)}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', border: '1px solid #000' }}>{emp.eventTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  // No grouping - simple list
                  <table className="audit-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Employee ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Employee Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Designation</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(group.employees || []).map((emp, empIndex) => (
                        <tr key={empIndex} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace' }}>{emp.employeeId}</td>
                          <td style={{ padding: '12px', fontWeight: '500' }}>{emp.employeeName}</td>
                          <td style={{ padding: '12px' }}>{emp.designation}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{
                              backgroundColor: '#dc3545',
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold'
                            }}>
                              {emp.issueCount}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '16px 24px', 
        background: '#f8f9fa', 
        borderTop: '1px solid #dee2e6',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6c757d'
      }}>
        <p style={{ margin: '4px 0' }}>Generated on {new Date().toLocaleString()}</p>
        <p style={{ margin: '4px 0', fontStyle: 'italic' }}>
          Note: This report shows employees who marked ON (F1) at least once but did not mark OFF (F4).
        </p>
      </div>
    </div>
  );
};

export default AuditReport;
