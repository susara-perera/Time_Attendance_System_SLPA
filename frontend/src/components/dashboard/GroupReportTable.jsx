import React from 'react';
import { replaceComCodes } from '../../utils/comMap';

// Props:
// - reportData: object with { dates: [], data: [employees...] }
// - formatPunchDate(date)
// - parseTimeMillis(value)
// - onExport (unused here but keep for future)

const GroupReportTable = ({ reportData, formatPunchDate, parseTimeMillis, formatTime }) => {
  if (!reportData || !reportData.data) return null;

  // Debug: Check what data we received
  console.log('GroupReportTable - reportData:', {
    hasDates: !!reportData.dates,
    datesLength: reportData.dates?.length,
    hasData: !!reportData.data,
    dataLength: reportData.data?.length,
    sampleEmployee: reportData.data?.[0],
    sampleDailyAttendance: reportData.data?.[0]?.dailyAttendance
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
            {reportData.dates && reportData.data ? (
              reportData.dates.map(date => (
                <React.Fragment key={`date-header-${date}`}>
                  <tr style={{ background: '#e9ecef' }}>
                    <td colSpan={7} style={{ fontWeight: 'bold', fontSize: '13px', textAlign: 'left', padding: '8px 12px', border: '1px solid #dee2e6' }}>
                      {`Date: ${formatPunchDate(date)}`}
                    </td>
                  </tr>
                  {reportData.data.map((record, empIdx) => {
                    const raw = record.dailyAttendance ? record.dailyAttendance[date] : null;
                    // If raw is an array of scans, render each scan as its own row (first row shows emp details)
                    if (Array.isArray(raw) && raw.length > 0) {
                      return raw.map((scan, sIdx) => {
                        const scanTime = scan.time_ || scan.time || scan.checkIn || scan.timestamp || '';
                        const scanType = (scan.scan_type || scan.type || '').toUpperCase();
                        const func = scanType === 'IN' ? 'F1-0' : (['OFF', 'OUT'].includes(scanType) ? 'F4-0' : '');
                        let desc = scan.eventDescription || scan.event || scan.description || '';
                        // remove parenthetical substrings that start with ID (e.g., "(ID & FP)")
                        desc = String(desc).replace(/\(\s*ID[^)]*\)/ig, '').trim();
                        // Replace any COM codes with human readable mapping
                        desc = replaceComCodes(desc);
                        return (
                          <tr key={`${date}-${empIdx}-${sIdx}`}>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{sIdx === 0 ? record.employeeId : ''}</td>
                            <td style={{ textAlign: 'left', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{sIdx === 0 ? record.employeeName : ''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{sIdx === 0 ? (scan.mealPktMny ?? record.mealPktMny ?? '') : ''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{sIdx === 0 ? formatPunchDate(date) : ''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{formatTime ? formatTime(scanTime) : scanTime}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{func}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{desc}</td>
                          </tr>
                        );
                      });
                    }

                    // Otherwise fallback to previous single-row rendering
                    const dayData = raw || {};
                    const ci = dayData?.checkIn || '';
                    const co = dayData?.checkOut || '';

                    // If both check-in and check-out exist, render two rows: first row shows employee details and check-in,
                    // second row shows check-out on a separate line with empty employee columns.
                    if (ci && co) {
                      return [
                        (
                          <tr key={`${date}-${empIdx}-in`}>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{record.employeeId}</td>
                            <td style={{ textAlign: 'left', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{record.employeeName}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{dayData?.mealPktMny ?? record.mealPktMny ?? ''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{formatPunchDate(date)}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6', whiteSpace: 'pre-line' }}>{formatTime ? formatTime(ci) : ci}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{'F1-0'}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{replaceComCodes(dayData?.eventDescription || '')}</td>
                          </tr>
                        ),
                        (
                          <tr key={`${date}-${empIdx}-out`}>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{''}</td>
                            <td style={{ textAlign: 'left', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{''}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6', whiteSpace: 'pre-line' }}>{formatTime ? formatTime(co) : co}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{'F4-0'}</td>
                            <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{''}</td>
                          </tr>
                        )
                      ];
                    }

                    const funcCode = ci ? 'F1-0' : (co ? 'F4-0' : '');
                    const punchTime = (ci && co) ? `${formatTime ? formatTime(ci) : ci} / ${formatTime ? formatTime(co) : co}` : (formatTime ? (formatTime(ci) || formatTime(co)) : (ci || co || ''));

                    return (
                      <tr key={`${date}-${empIdx}`}>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{record.employeeId}</td>
                        <td style={{ textAlign: 'left', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{record.employeeName}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{dayData?.mealPktMny ?? record.mealPktMny ?? ''}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{formatPunchDate(date)}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6', whiteSpace: 'pre-line' }}>{punchTime}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{funcCode}</td>
                        <td style={{ textAlign: 'center', fontSize: '11px', padding: '4px 6px', border: '1px solid #dee2e6' }}>{replaceComCodes((dayData?.eventDescription || '')?.toString().replace(/\(\s*ID[^)]*\)/ig, '').trim())}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GroupReportTable;
