import React from 'react';

// Props:
// - reportData: { data: [...] }
// - parseTimeMillis
// - formatTime
// - formatPunchDate

const IndividualReportTable = ({ reportData, parseTimeMillis, formatTime, formatPunchDate }) => {
  if (!reportData || !reportData.data) return null;

  const rows = [];

  // group by date
  const grouped = {};
  reportData.data.forEach(record => {
    const punchDate = new Date(record.date_).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: '2-digit'
    }).replace(/\//g, '-') + ' ' + new Date(record.date_).toLocaleDateString('en-US', { weekday: 'short' });
    if (!grouped[punchDate]) grouped[punchDate] = [];
    grouped[punchDate].push(record);
  });

  Object.keys(grouped).forEach(dateKey => {
    rows.push(
      <tr key={`date-header-${dateKey}`} style={{background:'#e9ecef'}}>
        <td colSpan={7} style={{fontWeight:'bold',fontSize:'13px',textAlign:'left',padding:'8px 12px',border:'1px solid #dee2e6'}}>{`Date: ${dateKey}`}</td>
      </tr>
    );

    // Aggregate rows per employee per date: show earliest IN and latest OUT
    grouped[dateKey].sort((a,b) => {
      const aTime = parseTimeMillis(a.time_ ?? a.checkIn ?? a.check_in ?? a.in_time ?? a.time ?? '');
      const bTime = parseTimeMillis(b.time_ ?? b.checkIn ?? b.check_in ?? b.in_time ?? b.time ?? '');
      return (aTime || 0) - (bTime || 0);
    });

    // Collapse multiple punches for the same employee into one row per date
    const empMap = {};
    grouped[dateKey].forEach(r => {
      const id = r.employee_ID || r.employeeId || r.employee_id || r.empNo || '';
      if (!empMap[id]) empMap[id] = [];
      empMap[id].push(r);
    });

    Object.keys(empMap).forEach((empId, idx) => {
      const punches = empMap[empId];
      let inTime = '';
      let outTime = '';

      // Compute earliest check-in and latest check-out from available fields (checkIn/checkOut/time_/time)
      let inMs = Infinity;
      let outMs = -Infinity;
      let inVal = '';
      let outVal = '';

      punches.forEach(p => {
        // consider multiple possible time fields on the record
        const candidates = [p.checkIn, p.check_in, p.in_time, p.time_, p.time, p.timestamp];
        candidates.forEach(candidate => {
          if (!candidate) return;
          const ms = parseTimeMillis(candidate);
          if (isNaN(ms)) return;
          if (ms < inMs) { inMs = ms; inVal = candidate; }
          if (ms > outMs) { outMs = ms; outVal = candidate; }
        });
      });

      if (inVal) inTime = formatTime ? formatTime(inVal) : String(inVal);
      if (outVal) outTime = formatTime ? formatTime(outVal) : String(outVal);

      const first = punches[0] || {};
      // Prefer explicit scan_type/status/type on punches when available, otherwise fall back to
      // computed in/out presence (earliest/latest times). This aligns Individual and Group views.
      const hasIn = punches.some(p => ((p.scan_type || p.status || p.type) || '').toString().toUpperCase() === 'IN');
      const hasOut = punches.some(p => ((p.scan_type || p.status || p.type) || '').toString().toUpperCase() === 'OUT');
      let func = '';
      if (hasIn && hasOut) func = 'F1-0 / F4-0';
      else if (hasIn) func = 'F1-0';
      else if (hasOut) func = 'F4-0';
      else {
        if (inTime && outTime) func = 'F1-0 / F4-0';
        else if (inTime) func = 'F1-0';
        else if (outTime) func = 'F4-0';
        else func = '';
      }

      const punchTimeCombined = (inTime && outTime) ? `${inTime} / ${outTime}` : (inTime || outTime || '');
      rows.push(
        <tr key={`${dateKey}-${idx}`}>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>{empId}</td>
          <td style={{textAlign:'left',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>{first.employee_name || first.employeeName || first.name || ''}</td>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>I</td>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>{dateKey}</td>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6', whiteSpace: 'pre-line'}}>
            {inTime || ''}
            {outTime ? (<><br/>{outTime}</>) : null}
          </td>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>{func}</td>
          <td style={{textAlign:'center',fontSize:'11px',padding:'4px 6px',border:'1px solid #dee2e6'}}>{''}</td>
        </tr>
      );
    });
  });

  return (
    <div className="data-preview">
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th style={{ textAlign: 'center' }}>Emp No</th>
              <th style={{ textAlign: 'left' }}>Emp Name</th>
              <th style={{ textAlign: 'center' }}>Meal-Pkt-Mny</th>
              <th style={{ textAlign: 'center' }}>Punch Date</th>
              <th style={{ textAlign: 'center' }}>Punch Time</th>
              <th style={{ textAlign: 'center' }}>Function</th>
              <th style={{ textAlign: 'center' }}>Event Description</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IndividualReportTable;
