import { useState, useCallback } from 'react';
import { Download, BarChart3 } from 'lucide-react';
import { initials, currentMonthStr } from '../utils';
import * as api from '../api';

export default function ReportsPage({ toast }) {
  const [month, setMonth] = useState(currentMonthStr());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async (m) => {
    setLoading(true);
    try {
      const data = await api.fetchAttendanceSummary(m);
      setSummary(data);
    } catch (err) {
      toast('Failed to load summary: ' + err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  function handleMonthChange(e) {
    setMonth(e.target.value);
    loadSummary(e.target.value);
  }

  // Calculate overall stats
  const totalPresent = summary?.employees?.reduce((a, e) => a + e.days_present, 0) || 0;
  const avgAttendance = summary?.employees?.length
    ? Math.round((totalPresent / (summary.employees.length * (summary.working_days || 1))) * 100)
    : 0;

  return (
    <>
      {/* Controls */}
      <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <BarChart3 size={18} style={{color:'var(--accent)'}} />
          <input
            type="month"
            className="date-input"
            value={month}
            onChange={handleMonthChange}
            max={currentMonthStr()}
          />
        </div>
        <button className="btn btn-primary" onClick={() => loadSummary(month)} disabled={loading}>
          {loading ? 'Loading…' : 'Generate Report'}
        </button>
        {summary && (
          <a
            href={api.getExportUrl(summary.month_start, summary.month_end)}
            className="btn btn-ghost"
            download
          >
            <Download size={14} /> Export Full Month CSV
          </a>
        )}
      </div>

      {summary && (
        <>
          {/* Month Overview KPIs */}
          <div className="kpi-grid" style={{marginBottom:24}}>
            <div className="kpi" data-color="blue">
              <div className="kpi-header">
                <div className="kpi-label">Working Days</div>
                <div className="kpi-icon">📅</div>
              </div>
              <div className="kpi-value">{summary.working_days}</div>
              <div className="kpi-sub">excluding Sundays</div>
            </div>
            <div className="kpi" data-color="green">
              <div className="kpi-header">
                <div className="kpi-label">Avg. Attendance</div>
                <div className="kpi-icon">📊</div>
              </div>
              <div className="kpi-value">{avgAttendance}%</div>
              <div className="kpi-sub">across all employees</div>
            </div>
            <div className="kpi" data-color="amber">
              <div className="kpi-header">
                <div className="kpi-label">Total Employees</div>
                <div className="kpi-icon">👥</div>
              </div>
              <div className="kpi-value">{summary.employees?.length || 0}</div>
              <div className="kpi-sub">registered</div>
            </div>
            <div className="kpi" data-color="red">
              <div className="kpi-header">
                <div className="kpi-label">Period</div>
                <div className="kpi-icon">🗓️</div>
              </div>
              <div className="kpi-value" style={{fontSize:18}}>{summary.month}</div>
              <div className="kpi-sub">{summary.month_start} to {summary.month_end}</div>
            </div>
          </div>

          {/* Employee Summary Cards */}
          <div className="panel" style={{marginBottom:24}}>
            <div className="panel-title">
              <div className="panel-icon"><BarChart3 size={14} /></div>
              Employee Attendance Summary
            </div>

            {/* Table View */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Days Present</th>
                    <th>Days Absent</th>
                    <th>Attendance %</th>
                    <th>Total Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.employees?.map((emp, i) => {
                    const pct = summary.working_days > 0
                      ? Math.round((emp.days_present / summary.working_days) * 100)
                      : 0;
                    return (
                      <tr key={emp.employee_id} style={{animationDelay:`${i*25}ms`}}>
                        <td>
                          <div className="cell-name">
                            <div className="avatar">{initials(emp.employee_name)}</div>
                            <span className="cell-name-text">{emp.employee_name}</span>
                          </div>
                        </td>
                        <td><span className="cell-code">{emp.employee_code}</span></td>
                        <td style={{fontSize:13, color:'var(--text-muted)'}}>{emp.department || '—'}</td>
                        <td>
                          <span style={{
                            fontWeight:700, fontSize:16,
                            color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
                          }}>
                            {emp.days_present}
                          </span>
                          <span style={{color:'var(--text-faint)', fontSize:12}}> / {summary.working_days}</span>
                        </td>
                        <td>
                          <span style={{fontWeight:700, fontSize:16, color:'var(--red)'}}>
                            {emp.days_absent}
                          </span>
                        </td>
                        <td>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <div style={{
                              width:50, height:6, borderRadius:3,
                              background:'var(--border-default)', overflow:'hidden'
                            }}>
                              <div style={{
                                width:`${pct}%`, height:'100%', borderRadius:3,
                                background: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)',
                                transition: 'width 0.5s ease'
                              }}></div>
                            </div>
                            <span style={{
                              fontWeight:700, fontSize:13,
                              color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
                            }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td><span style={{fontWeight:600, color:'var(--text-secondary)'}}>{emp.total_scans}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="summary-grid">
            {summary.employees?.map(emp => {
              const pct = summary.working_days > 0
                ? Math.round((emp.days_present / summary.working_days) * 100)
                : 0;
              return (
                <div className="summary-card" key={emp.employee_id}>
                  <div className="summary-card-header">
                    <div className="avatar">{initials(emp.employee_name)}</div>
                    <div>
                      <div className="summary-card-name">{emp.employee_name}</div>
                      <div className="summary-card-code">{emp.employee_code} · {emp.department || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="summary-stats">
                    <div className="summary-stat present">
                      <div className="summary-stat-value">{emp.days_present}</div>
                      <div className="summary-stat-label">Present</div>
                    </div>
                    <div className="summary-stat absent">
                      <div className="summary-stat-value">{emp.days_absent}</div>
                      <div className="summary-stat-label">Absent</div>
                    </div>
                    <div className="summary-stat scans">
                      <div className="summary-stat-value">{pct}%</div>
                      <div className="summary-stat-label">Rate</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!summary && (
        <div className="panel">
          <div className="empty-state" style={{padding:'80px 20px'}}>
            <div className="icon">📊</div>
            <p>Select a month and click <strong>Generate Report</strong>.</p>
            <small>View monthly attendance summaries with present/absent counts per employee.</small>
          </div>
        </div>
      )}
    </>
  );
}
