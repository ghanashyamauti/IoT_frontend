import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useInterval } from '../hooks';
import { initials, formatTime } from '../utils';
import * as api from '../api';

export default function TodayPage({ toast, employees, loadEmployees, rfidSerial }) {
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [activeView, setActiveView] = useState('attendance'); // 'attendance' | 'manage'

  // Add employee form
  const [empName, setEmpName] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Enrollment state
  const [enrollEmpId, setEnrollEmpId] = useState('');
  const [enrollStatus, setEnrollStatus] = useState(null); // null | 'waiting' | 'success' | 'error'
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollSecs, setEnrollSecs] = useState(30);
  const [activeEnrollId, setActiveEnrollId] = useState(null);
  const enrollTimerRef = useRef(null);

  // ── Load Attendance ──
  const loadAttendance = useCallback(async () => {
    try {
      const data = await api.fetchAttendanceToday();
      setAttendance(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {}
  }, []);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);
  useInterval(loadAttendance, 5000);

  // ── KPIs ──
  const presentCodes = new Set(attendance.filter(r => r.scan_type === 'IN').map(r => r.employee_code));
  const checkedIn = presentCodes.size;
  const pendingCount = Math.max(0, employees.length - checkedIn);
  const attendanceRate = employees.length > 0 ? Math.round((checkedIn / employees.length) * 100) : 0;

  // ── Add Employee ──
  async function handleAddEmployee(e) {
    e.preventDefault();
    if (!empName.trim() || !empCode.trim()) { toast('Name and code are required', 'err'); return; }
    setAdding(true);
    try {
      await api.addEmployee({
        name: empName.trim(),
        employee_code: empCode.trim(),
        department: empDept.trim(),
        email: empEmail.trim(),
      });
      toast(`${empName.trim()} added!`, 'ok');
      setEmpName(''); setEmpCode(''); setEmpDept(''); setEmpEmail('');
      loadEmployees();
    } catch (err) { toast(err.message, 'err'); }
    finally { setAdding(false); }
  }

  // ── USB Serial scan handler ──
  useEffect(() => {
    if (!rfidSerial) return;

    const unsub = rfidSerial.onUid(async (uid) => {
      const cleanUid = uid.trim().toUpperCase();

      // Enrollment mode active?
      if (activeEnrollId) {
        setEnrollStatus('waiting');
        setEnrollMsg(`Card detected: ${cleanUid}. Linking...`);
        try {
          const data = await api.enrollLink(activeEnrollId, cleanUid);
          if (data.success) {
            clearInterval(enrollTimerRef.current);
            setActiveEnrollId(null);
            setEnrollStatus('success');
            setEnrollMsg(`✓ Card ${cleanUid} linked to ${data.employee_name}!`);
            toast(`RFID Card ${cleanUid} linked to ${data.employee_name}!`, 'ok');
            loadEmployees();
          } else {
            setEnrollStatus('error');
            setEnrollMsg(data.message || 'Could not link card');
            toast(data.message, 'err');
          }
        } catch (err) {
          setEnrollStatus('error');
          setEnrollMsg('Backend communication error');
          toast('Backend error', 'err');
        }
        return;
      }

      // Normal scan
      try {
        const data = await api.sendScan(cleanUid);
        if (data.result === 'in') {
          toast(`Welcome, ${data.employee_name} (Checked IN) · ${cleanUid}`, 'ok');
          loadAttendance();
        } else if (data.result === 'out') {
          toast(`Goodbye, ${data.employee_name} (Checked OUT) · ${cleanUid}`, 'inf');
          loadAttendance();
        } else if (data.result === 'unknown') {
          toast(`Unknown Card: ${cleanUid}`, 'err');
        } else if (data.result === 'duplicate') {
          toast(`Card ${cleanUid} already scanned. Wait a moment.`, 'inf');
        } else {
          toast(`Scan recorded: ${cleanUid}`, 'inf');
          loadAttendance();
        }
      } catch (err) {
        toast('Scan error: ' + (err.message || 'Cannot reach backend'), 'err');
      }
    });

    return unsub;
  }, [rfidSerial, activeEnrollId, toast, loadAttendance, loadEmployees]);

  // ── Start Enrollment ──
  async function startEnroll() {
    const id = parseInt(enrollEmpId);
    if (!id) { toast('Select an employee first', 'err'); return; }

    // Try connecting USB reader
    if (rfidSerial?.isSupported() && !rfidSerial.isConnected) {
      try { await rfidSerial.connect(); } catch {}
    }

    setActiveEnrollId(id);
    setEnrollStatus('waiting');
    setEnrollMsg('Waiting for card tap...');
    setEnrollSecs(30);

    // Also arm backend
    try { await api.startEnrollment(id); } catch {}

    let secs = 30;
    clearInterval(enrollTimerRef.current);
    enrollTimerRef.current = setInterval(async () => {
      secs--;
      setEnrollSecs(secs);

      // Poll backend fallback
      try {
        const d = await api.getEnrollResult();
        if (d.status === 'success') {
          clearInterval(enrollTimerRef.current);
          setActiveEnrollId(null);
          setEnrollStatus('success');
          setEnrollMsg(`✓ Card linked to ${d.employee_name}`);
          toast(`Card enrolled for ${d.employee_name}`, 'ok');
          loadEmployees();
          return;
        }
      } catch {}

      if (secs <= 0) {
        clearInterval(enrollTimerRef.current);
        setActiveEnrollId(null);
        setEnrollStatus('error');
        setEnrollMsg('⏳ Timed out — no card detected. Try again.');
      }
    }, 1000);
  }

  // ── Filtered table rows ──
  const filtered = search
    ? attendance.filter(r => r.employee_name.toLowerCase().includes(search.toLowerCase()))
    : attendance;

  return (
    <>
      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="kpi" data-color="blue">
          <div className="kpi-header">
            <div className="kpi-label">Total Employees</div>
            <div className="kpi-icon">👤</div>
          </div>
          <div className="kpi-value">{employees.length}</div>
          <div className="kpi-sub">registered staff</div>
        </div>
        <div className="kpi" data-color="green">
          <div className="kpi-header">
            <div className="kpi-label">Present Today</div>
            <div className="kpi-icon">✅</div>
          </div>
          <div className="kpi-value">{checkedIn}</div>
          <div className="kpi-sub">checked in</div>
        </div>
        <div className="kpi" data-color="amber">
          <div className="kpi-header">
            <div className="kpi-label">Pending</div>
            <div className="kpi-icon">⏳</div>
          </div>
          <div className="kpi-value">{pendingCount}</div>
          <div className="kpi-sub">not marked yet</div>
        </div>
        <div className="kpi" data-color="purple">
          <div className="kpi-header">
            <div className="kpi-label">Attendance Rate</div>
            <div className="kpi-icon">📊</div>
          </div>
          <div className="kpi-value">{attendanceRate}%</div>
          <div className="kpi-sub">completion today</div>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="today-mobile-tabs">
        <button
          type="button"
          className={`today-tab-btn ${activeView === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveView('attendance')}
        >
          <span>📋 Live Attendance</span>
          <span className="today-tab-badge">{attendance.length}</span>
        </button>
        <button
          type="button"
          className={`today-tab-btn ${activeView === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveView('manage')}
        >
          <span>👥 Manage & Enroll</span>
          <span className="today-tab-badge">{employees.length}</span>
        </button>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* LEFT: Management Panels */}
        <div className={`today-manage-col ${activeView === 'manage' ? 'show-mobile' : ''}`}>
          {/* Add Employee */}
          <div className="panel">
            <div className="panel-title">
              <div className="panel-icon">+</div>
              Add Employee
            </div>
            <form onSubmit={handleAddEmployee}>
              <div className="field">
                <label>Full Name</label>
                <input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="field">
                <label>Employee Code</label>
                <input value={empCode} onChange={e => setEmpCode(e.target.value)} placeholder="e.g. EMP001" />
              </div>
              <div className="field">
                <label>Department <span style={{color:'var(--text-faint)', fontWeight:400}}>(optional)</span></label>
                <input value={empDept} onChange={e => setEmpDept(e.target.value)} placeholder="e.g. Operations" />
              </div>
              <div className="field">
                <label>Email Address <span style={{color:'var(--text-faint)', fontWeight:400}}>(for attendance alert emails)</span></label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={e => setEmpEmail(e.target.value)}
                  placeholder="e.g. rahul@shakham.com"
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={adding}>
                {adding ? 'Adding…' : '+ Add Employee'}
              </button>
            </form>
          </div>

          {/* Employee List */}
          <div className="panel">
            <div className="panel-title">
              <div className="panel-icon" style={{background:'var(--green-muted)', color:'var(--green)'}}>👤</div>
              Employees
            </div>
            <div className="emp-list">
              {employees.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">👤</div>
                  <p>No employees yet.</p>
                  <small>Add one above.</small>
                </div>
              ) : employees.map(e => (
                <div className="emp-row" key={e.id}>
                  <div className="avatar">{initials(e.name)}</div>
                  <div className="emp-info">
                    <div className="emp-name">{e.name}</div>
                    <div className="emp-sub">
                      {e.employee_code}{e.department ? ` · ${e.department}` : ''}{e.email ? ` · ✉️ ${e.email}` : ''}
                    </div>
                  </div>
                  <span className={`tag ${e.has_card ? 'tag-green' : 'tag-amber'}`}>
                    {e.has_card ? '✓ Card linked' : '⚠ No card'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Enroll Card */}
          <div className="panel">
            <div className="panel-title">
              <div className="panel-icon" style={{background:'var(--amber-muted)', color:'var(--amber)'}}>🔑</div>
              Link RFID Card to Employee
            </div>
            <p style={{fontSize:'12px', color:'var(--text-muted)', marginBottom:14, lineHeight:1.65}}>
              Select a person → click <strong>Start</strong> → tap their physical RFID card on the reader within 30 seconds.
            </p>
            <div className="field">
              <label>Select Employee</label>
              <select value={enrollEmpId} onChange={e => setEnrollEmpId(e.target.value)}>
                <option value="">— Select —</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>
                ))}
              </select>
            </div>
            <button className="btn btn-green btn-block" onClick={startEnroll} disabled={!!activeEnrollId}>
              🎬 Start Enrollment
            </button>

            {enrollStatus && (
              <div className={`enroll-box ${enrollStatus}`}>
                {enrollStatus === 'waiting' && <div className="spinner"></div>}
                <span>{enrollStatus === 'waiting' ? `${enrollMsg} ${enrollSecs}s` : enrollMsg}</span>
              </div>
            )}

            {enrollStatus === 'waiting' && (
              <div className="progress-track">
                <div className="progress-fill" style={{width: `${(enrollSecs/30)*100}%`}}></div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Attendance Table */}
        <div className={`panel today-attendance-col ${activeView === 'attendance' ? 'show-mobile' : ''}`}>
          <div className="section-header">
            <div className="left">
              <div className="section-title">Today's Attendance</div>
              <div className="live-pill"><div className="live-dot"></div>LIVE</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
              <div className="search-input">
                <Search size={16} />
                <input placeholder="Search name…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="last-updated">{lastUpdated && `Updated ${lastUpdated}`}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Card UID</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="5">
                    <div className="empty-state">
                      <div className="icon">⏳</div>
                      <p>No scans yet today.</p>
                      <small>Refreshes every 5 seconds automatically.</small>
                    </div>
                  </td></tr>
                ) : filtered.map((r, i) => (
                  <tr key={i} style={{animationDelay: `${i * 25}ms`}}>
                    <td>
                      <div className="cell-name">
                        <div className="avatar">{initials(r.employee_name)}</div>
                        <span className="cell-name-text">{r.employee_name}</span>
                      </div>
                    </td>
                    <td><span className="cell-code">{r.employee_code}</span></td>
                    <td><span className="cell-uid">{r.card_uid}</span></td>
                    <td><span className={`badge ${r.scan_type.toLowerCase()}`}>{r.scan_type}</span></td>
                    <td><span className="cell-time">{formatTime(r.scan_time, r.scan_datetime)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
