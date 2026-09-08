import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, UserCheck, UserX, Loader2, XCircle, Hand, RefreshCcw, Radio, Zap } from 'lucide-react';
import * as api from '../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(name = '') {
  const colors = [
    '#0d9488', '#0284c7', '#7c3aed', '#db2777',
    '#ea580c', '#16a34a', '#ca8a04', '#475569',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Single Employee Card ─────────────────────────────────────────────────────
function EmpCard({ emp, onSelect, onDirectMark, waitingFor, lastResult }) {
  const isWaiting = waitingFor === emp.id;
  const isSuccess = lastResult?.employee_name === emp.name && lastResult?.status === 'success';
  const scanType  = lastResult?.scan_type;

  return (
    <div className={`emp-manual-card${isWaiting ? ' waiting' : ''}${isSuccess ? ` done-${scanType?.toLowerCase()}` : ''}`}>
      <div
        className="emp-manual-avatar"
        style={{ background: avatarColor(emp.name) }}
      >
        {initials(emp.name)}
      </div>

      <div className="emp-manual-info">
        <span className="emp-manual-name">{emp.name}</span>
        <div className="emp-manual-meta">
          <span className="emp-manual-code">ID: {emp.employee_code}</span>
          {emp.department && <span className="emp-manual-dept">• {emp.department}</span>}
        </div>
      </div>

      <div className="emp-manual-actions">
        {isWaiting ? (
          <span className="manual-badge waiting-badge">
            <Loader2 size={13} className="spin-icon" />
            Tap Card Now…
          </span>
        ) : isSuccess ? (
          <span className={`manual-badge ${scanType === 'IN' ? 'in-badge' : 'out-badge'}`}>
            {scanType === 'IN' ? <CheckCircle size={13} /> : <UserX size={13} />}
            {scanType} Marked
          </span>
        ) : (
          <div className="emp-btn-group">
            <button
              className="btn-tap-arm"
              onClick={() => onSelect(emp)}
              title="Select this person and tap any card on the reader to mark"
            >
              <Radio size={13} /> Tap Card
            </button>
            <button
              className="btn-direct-mark"
              onClick={() => onDirectMark(emp)}
              title="Directly mark attendance without tapping physical card"
            >
              <Zap size={13} /> Direct
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManualPage({ employees, onRefreshEmployees, rfidSerial, toast }) {
  const [waitingFor, setWaitingFor]     = useState(null);   // employee id
  const [waitingName, setWaitingName]   = useState('');
  const [countdown, setCountdown]       = useState(0);
  const [lastResult, setLastResult]     = useState(null);   // {status, employee_name, scan_type, scan_time}
  const [resultLog, setResultLog]       = useState([]);     // running log of manual marks
  const [search, setSearch]             = useState('');
  const [error, setError]               = useState('');
  const [directLoading, setDirectLoading] = useState(false);

  const pollRef      = useRef(null);
  const countdownRef = useRef(null);
  const waitingForRef = useRef(waitingFor);
  waitingForRef.current = waitingFor;

  // ── Stop polling ───────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    pollRef.current      = null;
    countdownRef.current = null;
  }, []);

  // ── Cancel current wait ────────────────────────────────────────────────────
  const cancelWait = useCallback(async () => {
    stopPolling();
    setWaitingFor(null);
    setWaitingName('');
    setCountdown(0);
    try { await api.cancelManualAttend(); } catch {}
  }, [stopPolling]);

  // ── Commit attendance success ──────────────────────────────────────────────
  const commitSuccess = useCallback((resultData) => {
    stopPolling();
    setWaitingFor(null);
    setWaitingName('');
    setCountdown(0);
    setLastResult(resultData);
    setResultLog(prev => [
      {
        ...resultData,
        ts: Date.now(),
        scan_time: resultData.scan_time || new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 19),
    ]);
    if (toast) {
      toast('ok', `${resultData.employee_name || 'Employee'}: Attendance marked ${resultData.scan_type || 'IN'}!`);
    }
  }, [stopPolling, toast]);

  // ── Poll /manual/status (handles Wi-Fi scans) ──────────────────────────────
  const startPolling = useCallback((empId) => {
    stopPolling();

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.getManualStatus();
        if (res.status === 'success') {
          commitSuccess(res);
        }
      } catch {}
    }, 700);

    // Countdown
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          cancelWait();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [stopPolling, cancelWait, commitSuccess]);

  // ── USB Serial card tap listener (Web Serial API) ──────────────────────────
  useEffect(() => {
    if (!rfidSerial) return;
    const unsub = rfidSerial.onUid(async (uid) => {
      if (waitingForRef.current) {
        // We have an armed employee! Forward the UID scan to the backend
        try {
          const res = await api.sendScan(uid);
          if (res.result === 'in' || res.result === 'out') {
            commitSuccess({
              status: 'success',
              employee_name: res.employee_name || waitingName,
              scan_type: res.result.toUpperCase(),
              scan_time: res.scan_time,
            });
          } else if (res.result === 'duplicate') {
            if (toast) toast('warn', 'Card tapped too fast, please wait a moment.');
          }
        } catch (err) {
          setError(`Scan error: ${err.message}`);
        }
      } else {
        if (toast) {
          toast('warn', `Card tapped (${uid}). Click an employee first to assign attendance!`);
        }
      }
    });

    return unsub;
  }, [rfidSerial, waitingName, commitSuccess, toast]);

  // ── Select employee to arm for card tap ─────────────────────────────────────
  const handleSelect = useCallback(async (emp) => {
    setError('');
    setLastResult(null);
    try {
      await api.startManualAttend(emp.id);
      setWaitingFor(emp.id);
      setWaitingName(emp.name);
      startPolling(emp.id);
    } catch (e) {
      setError(`Failed to arm manual mode: ${e.message}`);
    }
  }, [startPolling]);

  // ── Direct mark (no physical card tap needed) ──────────────────────────────
  const handleDirectMark = useCallback(async (emp) => {
    setError('');
    setDirectLoading(true);
    try {
      // If currently waiting, cancel that wait
      if (waitingFor) await cancelWait();
      const res = await api.markAttendanceDirect(emp.id);
      commitSuccess({
        status: 'success',
        employee_name: res.employee_name || emp.name,
        scan_type: res.scan_type,
        scan_time: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      setError(`Failed to mark attendance: ${e.message}`);
      if (toast) toast('err', `Failed: ${e.message}`);
    } finally {
      setDirectLoading(false);
    }
  }, [waitingFor, cancelWait, commitSuccess, toast]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Filter employees ───────────────────────────────────────────────────────
  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content manual-page">

      {/* ─── Header ─── */}
      <div className="section-header">
        <div className="left">
          <UserCheck size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <h2 className="section-title">Single-Card Attendance Mode</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Use 1 test card for all employees, or mark attendance directly from screen
            </p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onRefreshEmployees}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      {/* ─── How it works banner ─── */}
      <div className="manual-how-it-works">
        <span className="how-step"><span className="how-num">1</span> Click <strong>Tap Card</strong> next to any employee</span>
        <span className="how-arrow">→</span>
        <span className="how-step"><span className="how-num">2</span> Tap your single RFID card on the reader</span>
        <span className="how-arrow">→</span>
        <span className="how-step"><span className="how-num">3</span> Attendance IN/OUT is recorded for that person!</span>
      </div>

      {/* ─── Active waiting overlay banner ─── */}
      {waitingFor && (
        <div className="manual-waiting-card">
          <div className="waiting-pulse">
            <span className="waiting-ring" />
            <Loader2 size={32} className="spin-icon" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="waiting-text">
            <p className="waiting-title">Ready! Tap your card now</p>
            <p className="waiting-name">{waitingName}</p>
            <p className="waiting-sub">Tap your RFID card on the RC522 scanner to confirm attendance</p>
          </div>
          <div className="waiting-footer">
            <span className="waiting-timer">{countdown}s remaining</span>
            <button className="btn btn-ghost btn-sm" onClick={cancelWait}>
              <XCircle size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Error message ─── */}
      {error && (
        <div className="manual-error">
          <XCircle size={16} /> {error}
        </div>
      )}

      <div className="manual-layout">

        {/* ─── Employee list ─── */}
        <div className="manual-list-panel">
          <div className="manual-search-wrap">
            <input
              className="manual-search"
              placeholder="Search employee by name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="emp-manual-list">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="icon">🔍</div>
                <p>No employees match "{search}"</p>
              </div>
            ) : (
              filtered.map(emp => (
                <EmpCard
                  key={emp.id}
                  emp={emp}
                  onSelect={handleSelect}
                  onDirectMark={handleDirectMark}
                  waitingFor={waitingFor}
                  lastResult={lastResult}
                />
              ))
            )}
          </div>
        </div>

        {/* ─── Live result log ─── */}
        <div className="manual-log-panel">
          <div className="manual-log-header">
            <p className="manual-log-title">Session Activity Log</p>
            <span className="manual-log-count">{resultLog.length} actions</span>
          </div>

          {resultLog.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="icon">📋</div>
              <p>No attendance marked yet in this session</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Select an employee and tap your card to begin!
              </p>
            </div>
          ) : (
            <ul className="manual-log-list">
              {resultLog.map((r, i) => (
                <li key={i} className={`manual-log-item ${r.scan_type === 'IN' ? 'log-in' : 'log-out'}`}>
                  <div
                    className="log-avatar"
                    style={{ background: avatarColor(r.employee_name) }}
                  >
                    {initials(r.employee_name)}
                  </div>
                  <div className="log-info">
                    <span className="log-name">{r.employee_name}</span>
                    <span className="log-time">{r.scan_time}</span>
                  </div>
                  <span className={`log-type ${r.scan_type === 'IN' ? 'in-badge' : 'out-badge'}`}>
                    {r.scan_type === 'IN'
                      ? <><CheckCircle size={12} /> IN</>
                      : <><UserX size={12} /> OUT</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
