import { useState, useCallback } from 'react';
import { Search, Download, Calendar } from 'lucide-react';
import { initials, todayStr, formatTime } from '../utils';
import * as api from '../api';

export default function HistoryPage({ toast }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [scans, setScans] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadHistory = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const data = await api.fetchAttendanceByDate(dateStr);
      setScans(data.scans || []);
      setTotal(data.total || 0);
      setLoaded(true);
    } catch (err) {
      toast('Failed to load attendance: ' + err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  function handleDateChange(e) {
    setSelectedDate(e.target.value);
    loadHistory(e.target.value);
  }

  // KPIs for selected date
  const statusMap = {};
  [...scans].reverse().forEach(r => { statusMap[r.employee_code] = r.scan_type; });
  const checkedIn  = Object.values(statusMap).filter(v => v === 'IN').length;
  const checkedOut = Object.values(statusMap).filter(v => v === 'OUT').length;
  const uniqueEmployees = new Set(scans.map(r => r.employee_code)).size;

  const filtered = search
    ? scans.filter(r => r.employee_name.toLowerCase().includes(search.toLowerCase()))
    : scans;

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <>
      {/* Controls */}
      <div className="history-controls" style={{display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <Calendar size={18} style={{color:'var(--accent)'}} />
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={handleDateChange}
            max={todayStr()}
          />
        </div>
        <button className="btn btn-primary" onClick={() => loadHistory(selectedDate)} disabled={loading}>
          {loading ? 'Loading…' : 'Load Attendance'}
        </button>
        {loaded && scans.length > 0 && (
          <a
            href={api.getExportUrl(selectedDate, selectedDate)}
            className="btn btn-ghost"
            download
          >
            <Download size={14} /> Export CSV
          </a>
        )}
      </div>

      {loaded && (
        <>
          {/* KPI Row for selected date */}
          <div className="kpi-grid" style={{marginBottom:24}}>
            <div className="kpi" data-color="blue">
              <div className="kpi-header">
                <div className="kpi-label">Employees Present</div>
                <div className="kpi-icon">👥</div>
              </div>
              <div className="kpi-value">{uniqueEmployees}</div>
              <div className="kpi-sub">{dateLabel}</div>
            </div>
            <div className="kpi" data-color="green">
              <div className="kpi-header">
                <div className="kpi-label">Checked In</div>
                <div className="kpi-icon">✅</div>
              </div>
              <div className="kpi-value">{checkedIn}</div>
              <div className="kpi-sub">currently in (at end of day)</div>
            </div>
            <div className="kpi" data-color="red">
              <div className="kpi-header">
                <div className="kpi-label">Checked Out</div>
                <div className="kpi-icon">🚪</div>
              </div>
              <div className="kpi-value">{checkedOut}</div>
              <div className="kpi-sub">left for the day</div>
            </div>
            <div className="kpi" data-color="amber">
              <div className="kpi-header">
                <div className="kpi-label">Total Scans</div>
                <div className="kpi-icon">📋</div>
              </div>
              <div className="kpi-value">{total}</div>
              <div className="kpi-sub">IN + OUT events</div>
            </div>
          </div>

          {/* Table */}
          <div className="panel">
            <div className="section-header">
              <div className="left">
                <div className="section-title">Attendance — {dateLabel}</div>
                {scans.length > 0 && (
                  <span className="badge" style={{background:'var(--bg-tertiary)', color:'var(--text-muted)', border:'1px solid var(--border-default)', fontSize:11}}>
                    {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
                  </span>
                )}
              </div>
              <div className="search-input">
                <Search size={16} />
                <input placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Card UID</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="6">
                      <div className="empty-state">
                        <div className="icon">📅</div>
                        <p>No attendance records for this date.</p>
                      </div>
                    </td></tr>
                  ) : filtered.map((r, i) => (
                    <tr key={i} style={{animationDelay: `${i * 20}ms`}}>
                      <td>
                        <div className="cell-name">
                          <div className="avatar">{initials(r.employee_name)}</div>
                          <span className="cell-name-text">{r.employee_name}</span>
                        </div>
                      </td>
                      <td><span className="cell-code">{r.employee_code}</span></td>
                      <td><span style={{fontSize:13, color:'var(--text-muted)'}}>{r.department || '—'}</span></td>
                      <td><span className="cell-uid">{r.card_uid}</span></td>
                      <td><span className={`badge ${r.scan_type.toLowerCase()}`}>{r.scan_type}</span></td>
                      <td><span className="cell-time">{formatTime(r.scan_time, r.scan_datetime)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loaded && (
        <div className="panel">
          <div className="empty-state" style={{padding:'80px 20px'}}>
            <div className="icon">📅</div>
            <p>Select a date and click <strong>Load Attendance</strong> to view historical records.</p>
            <small>You can view attendance for any past date.</small>
          </div>
        </div>
      )}
    </>
  );
}
