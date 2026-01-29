import React, { forwardRef, useImperativeHandle } from 'react';

const IndividualReport = forwardRef(({ reportData, getHeaders, formatRow, reportType, dateRange, employeeInfo }, ref) => {
  useImperativeHandle(ref, () => ({
    print: () => {
      if (!reportData || !Array.isArray(reportData.data) || reportData.data.length === 0) {
        alert('No data to print.');
        return;
      }
  const headers = getHeaders();
  // For individual report drop these columns (case-insensitive)
  const _dropSet = new Set(['emp no','emp name','meal-pkt-mny'].map(s=>s.toLowerCase()));
  const keepIndices = headers.map((h,i)=> _dropSet.has(String(h||'').trim().toLowerCase()) ? -1 : i).filter(i=>i>=0);
      // Build punches from reportData similar to GroupReport logic
      const punches = [];
      // prefer reportData.dates if present
      let dateOrder = Array.isArray(reportData.dates) && reportData.dates.length > 0 ? reportData.dates : [];
      if (dateOrder.length === 0) {
        const dateSet = new Set();
        reportData.data.forEach(r => {
          if (r.date_ || r.punchDate || r.date) dateSet.add(r.date_ || r.punchDate || r.date);
        });
        dateOrder = Array.from(dateSet).sort((a,b) => new Date(a)-new Date(b));
      }

      dateOrder.forEach(date => {
        reportData.data.forEach(r => {
          // 1) raw punches array
          if (Array.isArray(r.punches) && r.punches.length) {
            r.punches.forEach(p => {
              const pDate = p.date || p.date_ || r.date || r.punchDate || date;
              if (String(pDate) !== String(date)) return;
              punches.push({
                employee_ID: r.employee_ID || r.employeeId || '',
                employee_name: r.employee_name || r.employeeName || '',
                date_: date,
                time_: p.time || p.time_ || p.punchTime || '',
                scan_type: (p.scan_type || p.status || p.type || '').toString()
              });
            });
            return;
          }

          // 2) dailyAttendance keyed data
          if (r.dailyAttendance && r.dailyAttendance[date]) {
            const dayData = r.dailyAttendance[date];
            if (Array.isArray(dayData) && dayData.length) {
              dayData.forEach(p => punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: p.time || p.time_ || p.punchTime || '', scan_type: (p.scan_type || p.status || p.type || '').toString() }));
            } else {
              if (dayData.checkIn) punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: dayData.checkIn, scan_type: 'IN' });
              if (dayData.checkOut) punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: dayData.checkOut, scan_type: 'OUT' });
            }
            return;
          }

          // 3) fallback to flat record
          const recDate = r.date_ || r.punchDate || r.date;
          if (String(recDate) === String(date)) {
            const inferredType = r.scan_type || r.type || r.direction || '';
            punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: r.time_ || r.time || r.punchTime || '', scan_type: inferredType });
          }
        });
      });

      // sort punches (date, employee, time, IN before OUT)
      punches.sort((a,b)=>{
        const da = new Date(a.date_||''); const db = new Date(b.date_||''); if (!isNaN(da.getTime()) && !isNaN(db.getTime())){ if (da<db) return -1; if (da>db) return 1;} else { if ((a.date_||'')<(b.date_||'')) return -1; if ((a.date_||'')>(b.date_||'')) return 1; }
        const empA = String(a.employee_ID||''); const empB = String(b.employee_ID||''); if (empA<empB) return -1; if (empA>empB) return 1;
        const ta = a.time_||''; const tb = b.time_||''; if (ta<tb) return -1; if (ta>tb) return 1;
        const aIsIn = (a.scan_type||'').toUpperCase() === 'IN'; const bIsIn = (b.scan_type||'').toUpperCase() === 'IN'; if (aIsIn && !bIsIn) return -1; if (!aIsIn && bIsIn) return 1; return 0;
      });

      const sortedRecords = punches.map(p => {
        const rec = { ...p };
        const punchDate = new Date(p.date_);
        rec._punchDateKey = !isNaN(punchDate.getTime()) ? (punchDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\//g,'-') + ' ' + punchDate.toLocaleDateString('en-US', { weekday: 'short' })) : p.date_;
        return rec;
      });

  // Build pages with date headers and duplicate suppression
  // Set per-page data rows to 25 as requested
  const ROWS_PER_PAGE = 28; // exact number of data rows to show per printed page (individual reports)
      const pages = []; let currentPage = []; let lastKey = null; let lastDateHeader = null; let currentCount = 0;
      const pushPage = ()=>{ if (currentPage.length>0){ pages.push(currentPage.slice()); currentPage=[]; currentCount=0; lastKey=null; } };
      sortedRecords.forEach(record => {
        const dateHeader = record._punchDateKey || (record.date_ || '');
        // Individual reports should NOT include per-date bars; just track date for duplicate suppression
        if (lastDateHeader !== dateHeader) { lastDateHeader = dateHeader; lastKey = null; }
        const row = formatRow(record);
        const empIdVal = record.employee_ID || record.employeeId || record.emp_no || record.empNo || '';
        const dateVal = dateHeader; const key = `${empIdVal}||${dateVal}`;
        if (lastKey === key) { if (row.length>0) row[0]=''; if (row.length>1) row[1]=''; if (row.length>2) row[2]=''; if (row.length>3) row[3]=''; } else lastKey = key;
  currentPage.push(`<tr>${keepIndices.map((origI,colIdx)=>{ const cell = (row[origI]!==undefined?row[origI]:''); return `<td style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-size: 11px; white-space: pre-line;">${colIdx===0?'<strong>'+cell+'</strong>':cell}</td>`; }).join('')}</tr>`);
        currentCount++; if (currentCount >= ROWS_PER_PAGE) pushPage();
      }); if (currentPage.length>0) pages.push(currentPage.slice()); const totalPages = pages.length || 1;

      // Resolve employee number/name robustly (check common keys, then fall back to first data record)
      const empNo = employeeInfo?.employee_id
        || employeeInfo?.employee_ID
        || employeeInfo?.employeeId
        || employeeInfo?.employeeNo
        || employeeInfo?.emp_no
        || employeeInfo?.empNo
        || (reportData?.data && reportData.data[0] && (reportData.data[0].employee_id || reportData.data[0].employee_ID || reportData.data[0].employeeId || reportData.data[0].emp_no || reportData.data[0].empNo || ''))
        || '';

      const empName = employeeInfo?.name
        || employeeInfo?.employee_name
        || employeeInfo?.employeeName
        || (reportData?.data && reportData.data[0] && (reportData.data[0].employee_name || reportData.data[0].employeeName || reportData.data[0].name || ''))
        || '';

      const reportTitle = reportType === 'attendance' ? 'History Transaction Report' : 'Meal Consumption Report';
      const subtitle = reportType === 'attendance' ? 'All Granted(ID & FP) Records' : 'All Meal Records';

      function renderPage(pageRows, pageNum){
        const isLastPage = pageNum === totalPages;
        return `
          <div class="common-header" style="page-break-before: ${pageNum > 1 ? 'always' : 'auto'}; width:100%;">
            <div class="report-header" style="padding:8px 0; margin-bottom:6px;">
              <div class="header-content" style="max-width:1200px; margin:0 auto; padding:0; text-align:left; display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="max-width:70%;">
                  <h1 style="margin:0; display:flex; align-items:center; gap:8px; font-family: 'Courier New', monospace; font-size:14px;">${reportTitle}</h1>
                  <div class="header-subtitle" style="font-size:11px; margin-top:4px;"><strong>${subtitle}</strong></div>
                  <div style="height:8px">&nbsp;</div>
                  <table style="margin-bottom:12px; border-collapse:collapse; border: none;">
                    <tr><td style="vertical-align: top; padding-right: 8px; font-weight: bold; width: 90px; border: none;">Emp No :</td><td style="vertical-align: top; border: none;">${empNo}</td></tr>
                    <tr><td style="vertical-align: top; padding-right: 8px; font-weight: bold; border: none;">Emp Name :</td><td style="vertical-align: top; border: none;">${empName}</td></tr>
                    <tr><td style="vertical-align: top; padding-right: 8px; font-weight: bold; border: none;">Date From :</td><td style="vertical-align: top; border: none;">${dateRange.startDate} &nbsp; To : &nbsp; ${dateRange.endDate}</td></tr>
                  </table>
                </div>
                <div style="text-align:left; font-size:11px;" class="print-meta">
                  <div style="font-size:11px">Printed Date : ${new Date().toLocaleDateString()}</div>
                  <div style="font-size:11px">Printed Time : ${new Date().toLocaleTimeString()}</div>
                  <div style="font-size:11px">Page ${pageNum} of ${totalPages}</div>
                </div>
              </div>
            </div>
            <div class="header-content" style="max-width:1200px; margin:0 auto; padding:0;">
              <table style="width:100%; border-collapse: collapse;">
                <thead><tr>${keepIndices.map(i=>`<th style="font-size:12px; padding:4px 2px; border:0.5px solid #000; text-align:left;">${headers[i]}</th>`).join('')}</tr></thead>
                <tbody>${pageRows.join('')}</tbody>
              </table>
            </div>
            ${isLastPage ? `
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
          </div>
        `;
      }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${reportTitle}</title><style>
        body{font-family:'Courier New',monospace;font-size:11px;margin:20px;padding:24px 24px 0 24px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th,td{border:0.5px solid #000;padding:4px 6px;text-align:left}
  th{background:#f5f5f5;font-weight:bold;font-size:12px}
        td{font-size:11px;white-space:pre-line}
        @media print{@page{margin:0.5in;size:landscape}body{margin:0}thead{display:table-header-group!important}@page{margin-top:0;margin-bottom:0;margin-left:0;margin-right:0}body::before,body::after{display:none!important}}
      </style></head><body>${pages.map((p,idx)=>renderPage(p, idx+1)).join('')}</body></html>`;

      const w = window.open(' ', '', 'width=900,height=700');
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print(); w.close();
    }
  }));

  // preview rendering: build punches, inject date headers and suppress duplicates (show all records)
  const headers = getHeaders();
  const _dropSetPreview = new Set(['emp no','emp name','meal-pkt-mny'].map(s=>s.toLowerCase()));
  const previewKeepIndices = headers.map((h,i)=> _dropSetPreview.has(String(h||'').trim().toLowerCase()) ? -1 : i).filter(i=>i>=0);
  const previewElements = [];
  if (reportData && Array.isArray(reportData.data)) {
    // build punches similar to print
    const punches = [];
    let dateOrder = Array.isArray(reportData.dates) && reportData.dates.length > 0 ? reportData.dates : [];
    if (dateOrder.length === 0) {
      const dateSet = new Set();
      reportData.data.forEach(r => {
        if (r.date_ || r.punchDate || r.date) dateSet.add(r.date_ || r.punchDate || r.date);
      });
      dateOrder = Array.from(dateSet).sort((a,b) => new Date(a)-new Date(b));
    }
    dateOrder.forEach(date => {
      reportData.data.forEach(r => {
        // 1) raw punches array
        if (Array.isArray(r.punches) && r.punches.length) {
          r.punches.forEach(p => {
            const pDate = p.date || p.date_ || r.date || r.punchDate || date;
            if (String(pDate) !== String(date)) return;
            punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: p.time || p.time_ || p.punchTime || '', scan_type: (p.scan_type || p.status || p.type || '').toString() });
          });
          return;
        }

        // 2) dailyAttendance keyed data
        if (r.dailyAttendance && r.dailyAttendance[date]) {
          const dayData = r.dailyAttendance[date];
          if (Array.isArray(dayData) && dayData.length) {
            dayData.forEach(p => punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: p.time || p.time_ || p.punchTime || '', scan_type: (p.scan_type || p.status || p.type || '').toString() }));
          } else {
            if (dayData.checkIn) punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: dayData.checkIn, scan_type: 'IN' });
            if (dayData.checkOut) punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: dayData.checkOut, scan_type: 'OUT' });
          }
          return;
        }

        // 3) fallback to flat record
        const recDate = r.date_ || r.punchDate || r.date;
        if (String(recDate) === String(date)) {
          const inferredType = r.scan_type || r.type || r.direction || '';
          punches.push({ employee_ID: r.employee_ID || r.employeeId || '', employee_name: r.employee_name || r.employeeName || '', date_: date, time_: r.time_ || r.time || r.punchTime || '', scan_type: inferredType });
        }
      });
    });

    punches.sort((a,b)=>{
      const da = new Date(a.date_||''); const db = new Date(b.date_||''); if (!isNaN(da.getTime()) && !isNaN(db.getTime())){ if (da<db) return -1; if (da>db) return 1;} else { if ((a.date_||'')<(b.date_||'')) return -1; if ((a.date_||'')>(b.date_||'')) return 1; }
      const empA = String(a.employee_ID||''); const empB = String(b.employee_ID||''); if (empA<empB) return -1; if (empA>empB) return 1; const ta = a.time_||''; const tb = b.time_||''; if (ta<tb) return -1; if (ta>tb) return 1; const aIsIn = (a.scan_type||'').toUpperCase() === 'IN'; const bIsIn = (b.scan_type||'').toUpperCase() === 'IN'; if (aIsIn && !bIsIn) return -1; if (!aIsIn && bIsIn) return 1; return 0;
    });

    let lastKey = null; let lastDateSeen = null; let displayCount = 0;
    for (let i=0;i<punches.length;i++) {
      const p = punches[i];
      const dateVal = p.date_ || '';
      if (lastDateSeen !== dateVal) {
        // Skip inserting a visual date bar for individual preview; just reset duplicate suppression keys
        lastDateSeen = dateVal; lastKey = null; 
      }
      const row = formatRow(p);
      const empIdVal = p.employee_ID || p.employeeId || '';
      const key = `${empIdVal}||${dateVal}`;
      if (lastKey === key) { if (row.length>0) row[0]=''; if (row.length>1) row[1]=''; if (row.length>2) row[2]=''; if (row.length>3) row[3]= ''; } else lastKey = key;
      previewElements.push(
        <tr key={`row-${i}`}>
          {previewKeepIndices.map((origI,ci)=>{ const cell = row[origI]!==undefined? row[origI] : ''; return (<td key={ci} style={{whiteSpace:'pre-line', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6'}}>{ci===0? <strong>{cell}</strong> : cell}</td>); })}
        </tr>
      );
      displayCount++;
    }
  }

  return (
    <div>
      <table className="table table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{previewKeepIndices.map((i,idx)=>(<th key={idx} style={{ fontSize: '12px', background: '#f5f5f5', fontWeight: 'bold', padding: '4px 2px', border: '0.5px solid #dee2e6', textAlign: 'left' }}>{headers[i]}</th>))}</tr>
        </thead>
        <tbody>
          {previewElements}
        </tbody>
      </table>
    </div>
  );
});

export default IndividualReport;
