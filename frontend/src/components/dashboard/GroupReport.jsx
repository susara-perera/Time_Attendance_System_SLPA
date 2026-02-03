import React, { forwardRef, useImperativeHandle } from 'react';

const GroupReport = forwardRef(({ reportData, getHeaders, formatRow, reportType, dateRange }, ref) => {
  // Debug: Log what data we received
  console.log('GroupReport - reportData:', {
    hasData: !!reportData,
    dataLength: reportData?.data?.length,
    hasDates: !!reportData?.dates,
    datesLength: reportData?.dates?.length,
    sampleEmployee: reportData?.data?.[0],
    sampleDailyAttendance: reportData?.data?.[0]?.dailyAttendance,
    firstDateKey: reportData?.dates?.[0],
    firstDateData: reportData?.data?.[0]?.dailyAttendance?.[reportData?.dates?.[0]]
  });

  useImperativeHandle(ref, () => ({
    print: () => {
      if (!reportData || !Array.isArray(reportData.data) || reportData.data.length === 0) {
        alert('No data to print.');
        return;
      }
      const headers = getHeaders();
      // (old flat rows building removed — we now build `punches` and `sortedRecords` below)

      const reportTitle = reportType === 'attendance' ? 'History Transaction Report' : 'Meal Consumption Report';
      const subtitle = reportType === 'attendance' ? 'All Granted(ID & FP) Records' : 'All Meal Records';

      // Build flat punches and sort (date, emp, time, IN before OUT)
      const punches = [];
      // Determine date order: prefer reportData.dates if present
      let dateOrder = Array.isArray(reportData.dates) && reportData.dates.length > 0 ? reportData.dates : [];
      if (dateOrder.length === 0) {
        const dateSet = new Set();
        reportData.data.forEach(emp => {
          if (Array.isArray(emp.punches)) emp.punches.forEach(p => dateSet.add(p.date || p.punchDate || p.date_));
          if (emp.dailyAttendance) Object.keys(emp.dailyAttendance).forEach(k => dateSet.add(k));
        });
        dateOrder = Array.from(dateSet).sort((a,b) => new Date(a)-new Date(b));
      }

      // Create punches in date-first order
      dateOrder.forEach(date => {
        reportData.data.forEach(emp => {
          if (Array.isArray(emp.punches) && emp.punches.length) {
            emp.punches.filter(p => String(p.date || p.punchDate || p.date_) === String(date)).forEach((p, pIndex) => {
              const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
              punches.push({
                employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo,
                employee_name: emp.employeeName || emp.employee_name || emp.name,
                date_: date,
                time_: p.time || p.punchTime || p.time_ || '',
                scan_type: inferredType
              });
            });
          } else if (emp.dailyAttendance && emp.dailyAttendance[date]) {
            const dayData = emp.dailyAttendance[date];
            // Check if dayData is directly an array (backend returns it this way)
            if (Array.isArray(dayData) && dayData.length) {
              dayData.forEach((p, pIndex) => {
                const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
                punches.push({ 
                  employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, 
                  employee_name: emp.employeeName || emp.employee_name || emp.name, 
                  date_: date, 
                  time_: p.time || p.time_ || '', 
                  scan_type: inferredType,
                  eventDescription: p.eventDescription || ''
                });
              });
            } else if (Array.isArray(dayData.punches) && dayData.punches.length) {
              dayData.punches.forEach((p, pIndex) => {
                const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
                punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: p.time || p.time_ || '', scan_type: inferredType });
              });
            } else {
              if (dayData.checkIn) punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: dayData.checkIn, scan_type: 'IN' });
              if (dayData.checkOut) punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: dayData.checkOut, scan_type: 'OUT' });
            }
          }
        });
      });

      // Sort punches
      punches.sort((a,b)=>{
        const da = new Date(a.date_|| ''); const db = new Date(b.date_|| '');
        if (!isNaN(da.getTime()) && !isNaN(db.getTime())) { if (da < db) return -1; if (da > db) return 1; }
        else { if ((a.date_||'') < (b.date_||'')) return -1; if ((a.date_||'') > (b.date_||'')) return 1; }
        const empA = String(a.employee_ID||''); const empB = String(b.employee_ID||''); if (empA < empB) return -1; if (empA > empB) return 1;
        const ta = a.time_||''; const tb = b.time_||''; if (ta < tb) return -1; if (ta > tb) return 1;
        const aIsIn = (a.scan_type||'').toUpperCase() === 'IN'; const bIsIn = (b.scan_type||'').toUpperCase() === 'IN'; if (aIsIn && !bIsIn) return -1; if (!aIsIn && bIsIn) return 1; return 0;
      });

      // Build sortedRecords with display punch date key
      const sortedRecords = punches.map(p => {
        const rec = { ...p };
        const punchDate = new Date(p.date_);
        rec._punchDateKey = !isNaN(punchDate.getTime()) ? (punchDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g,'-') + ' ' + punchDate.toLocaleDateString('en-US', { weekday: 'short' })) : p.date_;
        return rec;
      });

      // Build pages with date headers and duplicate suppression; start new page on date change
  // Reserve a couple of record rows at the bottom of each printed page for spacing/signature
  const PAGE_RECORDS = 31; // visual target per page including reserved rows
  const RESERVED_ROWS = 2; // number of empty record slots to leave at bottom of each page
  const ROWS_PER_PAGE = Math.max(1, PAGE_RECORDS - RESERVED_ROWS);
      const pages = [];
      let currentPage = []; let lastKey = null; let lastDateHeader = null; let currentCount = 0;
      const pushPage = () => { if (currentPage.length>0) { pages.push(currentPage.slice()); currentPage=[]; currentCount=0; lastKey=null; } };

      sortedRecords.forEach(record => {
        const dateHeader = record._punchDateKey || (record.date_ || '');
        if (lastDateHeader !== dateHeader) {
          lastDateHeader = dateHeader;
          // inject date header row (highlighted to match preview) without forcing a page break
          currentPage.push(`<tr style="background: #dfe7ff;"><td colspan="7" style="font-weight: 700; font-size: 11px; color: #000; text-align: left; padding: 10px 14px; border: 1px solid #0a0a0aff;">Date: ${dateHeader}</td></tr>`);
          currentCount++; lastKey = null;
        }

        const row = formatRow(record);
        const empIdVal = record.employee_ID || record.employeeId || record.emp_no || record.empNo || '';
        const dateVal = dateHeader;
        const key = `${empIdVal}||${dateVal}`;
        if (lastKey === key) {
          if (row.length>0) row[0]=''; if (row.length>1) row[1]=''; if (row.length>2) row[2]=''; if (row.length>3) row[3]='';
        } else lastKey = key;

        currentPage.push(`<tr>${row.map((cell,ci)=>`<td style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 11px; white-space: pre-line;">${ci===0?'<strong>'+cell+'</strong>':cell}</td>`).join('')}</tr>`);
        currentCount++;
        if (currentCount >= ROWS_PER_PAGE) pushPage();
      });
      if (currentPage.length>0) pages.push(currentPage.slice());
      const totalPages = pages.length || 1;

      const renderPage = (pageRows, pageNum) => `
        <div class="common-header" style="page-break-before: ${pageNum > 1 ? 'always' : 'auto'}; width:100%;">
          <div class="report-header" style="padding:8px 0; margin-bottom:6px;">
            <div class="header-content" style="max-width:1200px; margin:0 auto; padding:0 12px; text-align:left; display:flex; justify-content:space-between; align-items:flex-start;">
              <div style="max-width:70%;">
                <h1 style="margin:0; display:flex; align-items:center; gap:8px; font-family: 'Courier New', monospace; font-size:14px;">${reportTitle}</h1>
                <div class="header-subtitle" style="font-size:11px; margin-top:4px;"><strong>${subtitle}</strong></div>
                <div style="height:8px">&nbsp;</div>
                <div class="date-range" style="margin-top:6px; font-size:11px;"><strong>Date From :</strong> ${dateRange.startDate} <strong>To :</strong> ${dateRange.endDate}</div>
              </div>
              <div style="text-align:left; font-size:11px;" class="print-meta">
                <div style="font-size:11px">Printed Date : ${new Date().toLocaleDateString()}</div>
                <div style="font-size:11px">Printed Time : ${new Date().toLocaleTimeString()}</div>
                <div style="font-size:11px">Page ${pageNum} of ${totalPages}</div>
              </div>
            </div>
          </div>
          <div class="header-content" style="max-width:1200px; margin:0 auto; padding:0 12px;">
            <table style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>${headers.map(h=>{ const key = String(h||'').trim().toLowerCase(); const isMeal = key === 'meal-pkt-mny'; return `<th style="font-size:12px; padding:4px 2px; border:0.5px solid #000; text-align:left; ${isMeal ? 'width:8%;' : ''}">${h}</th>` }).join('')}</tr>
              </thead>
              <tbody>
                ${pageRows.join('')}
              </tbody>
            </table>
          </div>
          ${pageNum === totalPages ? `
            <div style="margin-top: 60px; width: 100%;">
              <table style="width:100%; border-collapse: collapse; border: none;">
                <tbody>
                  <tr>
                    <td style="width:15%; vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Date</td>
                    <td style="width:35%; vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                    <td style="width:15%; vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Date</td>
                    <td style="width:35%; vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                  </tr>
                  <tr>
                    <td style="vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Authorized Signature 1</td>
                    <td style="vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                    <td style="vertical-align: middle; padding:6px 8px; border: none; font-size:11px; white-space: nowrap;">Authorized Signature 2</td>
                    <td style="vertical-align: middle; padding:6px 8px; border: none; white-space: nowrap;"><span style="display:inline-block; font-family: 'Courier New', monospace; font-size:9px; letter-spacing:1px; line-height:1;">....................</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${reportTitle}</title><style>
        body{font-family:'Courier New',monospace;font-size:11px;margin:20px;padding:24px 24px 0 24px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th,td{border:0.5px solid #000;padding:4px 6px;text-align:left}
  th{background:#f5f5f5;font-weight:bold;font-size:12px}
        td{font-size:11px;white-space:pre-line}
        @media print{@page{margin:0.5in;size:landscape}body{margin:0}thead{display:table-header-group!important}@page{margin-top:0;margin-bottom:0;margin-left:0;margin-right:0}body::before,body::after{display:none!important}}
      </style></head><body>${pages.map((p,idx)=>renderPage(p, idx+1)).join('')}</body></html>`;

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) {
        alert('Pop-up blocked! Please allow pop-ups for this site to print.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      
      // Wait for content to load before triggering print dialog
      // The print dialog allows user to "Save as PDF" as destination
      setTimeout(() => {
        w.focus();
        w.print();
        // Note: Window will stay open so user can review or re-print
      }, 500);
    }
  }));

  // preview rendering: build punches, sort, inject date headers and suppress duplicate Emp/Name/Date
  const headers = getHeaders();
  const previewElements = [];
  if (reportData && Array.isArray(reportData.data)) {
    // build punches in date-first order
    const punches = [];
    let dateOrder = Array.isArray(reportData.dates) && reportData.dates.length > 0 ? reportData.dates : [];
    if (dateOrder.length === 0) {
      const dateSet = new Set();
      reportData.data.forEach(emp => {
        if (Array.isArray(emp.punches)) emp.punches.forEach(p => dateSet.add(p.date || p.punchDate || p.date_));
        if (emp.dailyAttendance) Object.keys(emp.dailyAttendance).forEach(k => dateSet.add(k));
      });
      dateOrder = Array.from(dateSet).sort((a,b) => new Date(a)-new Date(b));
    }

    dateOrder.forEach(date => {
      reportData.data.forEach(emp => {
        if (Array.isArray(emp.punches) && emp.punches.length) {
          emp.punches.filter(p => String(p.date || p.punchDate || p.date_) === String(date)).forEach((p, pIndex) => {
            const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
            punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: p.time || p.punchTime || p.time_ || '', scan_type: inferredType });
          });
        } else if (emp.dailyAttendance && emp.dailyAttendance[date]) {
          const dayData = emp.dailyAttendance[date];
          // Check if dayData is directly an array (backend returns it this way)
          if (Array.isArray(dayData) && dayData.length) {
            dayData.forEach((p, pIndex) => {
              const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
              punches.push({ 
                employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, 
                employee_name: emp.employeeName || emp.employee_name || emp.name, 
                date_: date, 
                time_: p.time || p.time_ || '', 
                scan_type: inferredType,
                eventDescription: p.eventDescription || ''
              });
            });
          } else if (Array.isArray(dayData.punches) && dayData.punches.length) {
            dayData.punches.forEach((p, pIndex) => {
              const inferredType = (p && (p.scan_type || p.type || p.direction)) ? (p.scan_type || p.type || p.direction) : (pIndex % 2 === 0 ? 'IN' : 'OUT');
              punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: p.time || p.time_ || '', scan_type: inferredType });
            });
          } else {
            if (dayData.checkIn) punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: dayData.checkIn, scan_type: 'IN' });
            if (dayData.checkOut) punches.push({ employee_ID: emp.employeeId || emp.employee_ID || emp.emp_no || emp.empNo, employee_name: emp.employeeName || emp.employee_name || emp.name, date_: date, time_: dayData.checkOut, scan_type: 'OUT' });
          }
        }
      });
    });

    // sort punches
    punches.sort((a,b) => {
      const da = new Date(a.date_||''); const db = new Date(b.date_||'');
      if (!isNaN(da.getTime()) && !isNaN(db.getTime())) { if (da < db) return -1; if (da > db) return 1; } else { if ((a.date_||'') < (b.date_||'')) return -1; if ((a.date_||'') > (b.date_||'')) return 1; }
      const empA = String(a.employee_ID||''); const empB = String(b.employee_ID||''); if (empA < empB) return -1; if (empA > empB) return 1;
      const ta = a.time_||''; const tb = b.time_||''; if (ta < tb) return -1; if (ta > tb) return 1;
      const aIsIn = (a.scan_type||'').toUpperCase() === 'IN'; const bIsIn = (b.scan_type||'').toUpperCase() === 'IN'; if (aIsIn && !bIsIn) return -1; if (!aIsIn && bIsIn) return 1; return 0;
    });

    // build preview elements: inject date headers and suppress duplicates, show all records
    let lastKey = null; let lastDateSeen = null; let displayCount = 0;
    for (let i = 0; i < punches.length; i++) {
      const p = punches[i];
      const dateVal = p.date_ || '';
      if (lastDateSeen !== dateVal) {
        // insert date header row — apply background to TD to prevent Bootstrap row striping from hiding it
        previewElements.push(
          <tr key={`date-header-${dateVal}`}>
            <td colSpan={7} style={{ background: '#dfe7ff', fontWeight: 700, fontSize: '11px', color: '#000', textAlign: 'left', padding: '10px 14px', border: '1px solid #c7d2e8' }}>
              {`Date: ${new Date(dateVal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g, '-')} ${new Date(dateVal).toLocaleDateString('en-US', { weekday: 'short' })}`}
            </td>
          </tr>
        );
        lastDateSeen = dateVal; lastKey = null; displayCount++;
      }

      const row = formatRow(p);
      const empIdVal = p.employee_ID || p.employeeId || '';
      const key = `${empIdVal}||${dateVal}`;
      if (lastKey === key) {
        if (row.length > 0) row[0] = '';
        if (row.length > 1) row[1] = '';
        if (row.length > 2) row[2] = '';
        if (row.length > 3) row[3] = '';
      } else {
        lastKey = key;
      }

      previewElements.push(
        <tr key={`row-${i}`}>
          {row.map((cell, ci) => (
            <td key={ci} style={{ whiteSpace: 'pre-line', textAlign: 'left', fontSize: '11px', padding: '4px 6px', verticalAlign: 'middle', border: '1px solid #dee2e6' }}>
              {ci === 0 ? <strong>{cell}</strong> : cell}
            </td>
          ))}
        </tr>
      );
      displayCount++;
    }
  }

  return (
    <div>
      <table className="table table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{headers.map((h, i) => {
            const key = String(h || '').trim().toLowerCase();
            const isMeal = key === 'meal-pkt-mny';
            return (<th key={i} style={{ fontSize: '12px', background: '#f5f5f5', fontWeight: 'bold', padding: '4px 2px', border: '0.5px solid #dee2e6', textAlign: 'left', width: isMeal ? '8%' : undefined }}>{h}</th>);
          })}</tr>
        </thead>
        <tbody>
          {!reportData || !Array.isArray(reportData.data) || reportData.data.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '14px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  border: '3px solid #f3f3f3',
                  borderTop: '3px solid #007bff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 15px'
                }}></div>
                Loading attendance records...
              </td>
            </tr>
          ) : (
            previewElements
          )}
        </tbody>
      </table>
    </div>
  );
});

export default GroupReport;
