import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { initials, todayStr } from '../utils';
import * as api from '../api';

export default function DirectAttendancePage({ toast, employees, loadEmployees }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dateRecords, setDateRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PRESENT' | 'ABSENT' | 'NOT_MARKED'
  const [submittingId, setSubmittingId] = useState(null);

  // Custom Time / Advanced Modal state
  const [modalEmp, setModalEmp] = useState(null);
  const [modalScanType, setModalScanType] = useState('IN'); // 'IN' (Present) | 'ABSENT'
  const [modalTime, setModalTime] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // ── Load status for the selected date ──
  const loadDateStatus = useCallback(async (d) => {
    setLoadingRecords(true);
    try {
      const data = await api.fetchDateStatus(d);
      setDateRecords(data.records || []);
    } catch (err) {
      toast('Failed to load attendance for ' + d + ': ' + err.message, 'err');
    } finally {
      setLoadingRecords(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDateStatus(selectedDate);
  }, [selectedDate, loadDateStatus]);

  // ── Date Navigation Helpers ──
  function changeDateBy(days) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  }

  // ── 1-Click Direct Mark (Present or Absent) ──
  async function handleDirectMark(emp, actionType) {
    const empId = emp.employee_id || emp.id;
    setSubmittingId(empId);
    try {
      const res = await api.markDirectAttendance({
        employee_id: empId,
        date: selectedDate,
        scan_type: actionType, // 'IN' (Present) or 'ABSENT'
        note: actionType === 'ABSENT' ? 'Marked Absent by Admin' : 'Marked Present by Admin',
      });
      toast(res.message || `Marked ${actionType === 'ABSENT' ? 'ABSENT' : 'PRESENT'} for ${emp.name}`, 'ok');
      await loadDateStatus(selectedDate);
      if (loadEmployees) loadEmployees();
    } catch (err) {
      toast('Action failed: ' + err.message, 'err');
    } finally {
      setSubmittingId(null);
    }
  }

  // ── Modal Submit (with custom time or note) ──
  async function handleModalSubmit(e) {
    e.preventDefault();
    if (!modalEmp) return;
    setModalSubmitting(true);
    try {
      const res = await api.markDirectAttendance({
        employee_id: modalEmp.employee_id || modalEmp.id,
        date: selectedDate,
        time: modalTime || null,
        scan_type: modalScanType,
        note: modalNote.trim() || undefined,
      });
      toast(res.message || 'Attendance saved successfully', 'ok');
      setModalEmp(null);
      setModalTime('');
      setModalNote('');
      await loadDateStatus(selectedDate);
      if (loadEmployees) loadEmployees();
    } catch (err) {
      toast('Failed to save: ' + err.message, 'err');
    } finally {
      setModalSubmitting(false);
    }
  }

  // ── KPIs ──
  const presentCount = dateRecords.filter(r => r.status === 'PRESENT' || r.status === 'IN').length;
  const absentCount = dateRecords.filter(r => r.status === 'ABSENT').length;
  const notMarkedCount = dateRecords.filter(r => r.status === 'NOT_MARKED').length;

  // ── Filtering ──
  const filteredRecords = dateRecords.filter(r => {
    // Status filter
    if (statusFilter === 'PRESENT' && (r.status !== 'PRESENT' && r.status !== 'IN')) return false;
    if (statusFilter === 'ABSENT' && r.status !== 'ABSENT') return false;
    if (statusFilter === 'NOT_MARKED' && r.status !== 'NOT_MARKED') return false;

    // Search query
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.employee_code?.toLowerCase().includes(q) ||
      (r.department && r.department.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q))
    );
  });

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const isToday = selectedDate === todayStr();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Top Bar: Date Navigator & Refresh ── */}
      <div
        className="direct-header-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 20,
          background: 'var(--bg-secondary)',
          padding: '14px 18px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Date Selector with Next / Prev */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => changeDateBy(-1)}
            title="Previous Day"
            style={{ padding: '6px 10px' }}
          >
            <ChevronLeft size={16} />
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-primary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          >
            <Calendar size={16} style={{ color: 'var(--accent)' }} />
            <input
              type="date"
              className="date-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 13.5,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => changeDateBy(1)}
            title="Next Day"
            style={{ padding: '6px 10px' }}
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            className={`btn btn-sm ${isToday ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedDate(todayStr())}
          >
            Today
          </button>
        </div>

        {/* Refresh Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => loadDateStatus(selectedDate)}
            disabled={loadingRecords}
          >
            <RefreshCw size={13} className={loadingRecords ? 'spinner' : ''} />
            <span>{loadingRecords ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Compact KPIs Row ── */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi" data-color="blue" onClick={() => setStatusFilter('ALL')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <div className="kpi-label">Total Staff</div>
            <div className="kpi-icon">👥</div>
          </div>
          <div className="kpi-value">{dateRecords.length}</div>
          <div className="kpi-sub">{dateLabel}</div>
        </div>

        <div className="kpi" data-color="green" onClick={() => setStatusFilter('PRESENT')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <div className="kpi-label">Present</div>
            <div className="kpi-icon">✅</div>
          </div>
          <div className="kpi-value">{presentCount}</div>
          <div className="kpi-sub">Checked in on this date</div>
        </div>

        <div className="kpi" data-color="red" onClick={() => setStatusFilter('ABSENT')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <div className="kpi-label">Absent</div>
            <div className="kpi-icon">❌</div>
          </div>
          <div className="kpi-value">{absentCount}</div>
          <div className="kpi-sub">Marked absent</div>
        </div>

        <div className="kpi" data-color="amber" onClick={() => setStatusFilter('NOT_MARKED')} style={{ cursor: 'pointer' }}>
          <div className="kpi-header">
            <div className="kpi-label">Not Marked</div>
            <div className="kpi-icon">⏳</div>
          </div>
          <div className="kpi-value">{notMarkedCount}</div>
          <div className="kpi-sub">Pending action</div>
        </div>
      </div>

      {/* ── Main Panel: Employee Attendance Table ── */}
      <div className="panel" style={{ padding: '20px 22px' }}>
        {/* Table Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 18,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Status Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
              Filter:
            </span>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter('ALL')}
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              All ({dateRecords.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'PRESENT' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter('PRESENT')}
              style={{ fontSize: 12, padding: '5px 12px', color: statusFilter === 'PRESENT' ? '#fff' : 'var(--green)' }}
            >
              Present ({presentCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'ABSENT' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter('ABSENT')}
              style={{ fontSize: 12, padding: '5px 12px', color: statusFilter === 'ABSENT' ? '#fff' : 'var(--red)' }}
            >
              Absent ({absentCount})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'NOT_MARKED' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter('NOT_MARKED')}
              style={{ fontSize: 12, padding: '5px 12px', color: statusFilter === 'NOT_MARKED' ? '#fff' : 'var(--amber)' }}
            >
              Not Marked ({notMarkedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="search-input" style={{ minWidth: 260, maxWidth: 360, flex: 1 }}>
            <Search size={16} />
            <input
              placeholder="Search by name, code, dept, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Clean Responsive Attendance Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '32%' }}>Employee Details</th>
                <th style={{ width: '16%' }}>Code & Department</th>
                <th style={{ width: '22%' }}>Status on Date</th>
                <th style={{ width: '30%', textAlign: 'right' }}>Direct Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state" style={{ padding: '36px 12px' }}>
                      <div className="icon">👥</div>
                      <p>No employee records found matching your filters.</p>
                      <small>Try selecting a different date or clearing the search query.</small>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => {
                  const isPresent = r.status === 'PRESENT' || r.status === 'IN';
                  const isAbsent = r.status === 'ABSENT';
                  const isNotMarked = r.status === 'NOT_MARKED';
                  const isBusy = submittingId === r.employee_id;

                  return (
                    <tr key={r.employee_id} style={{ animationDelay: `${i * 15}ms` }}>
                      {/* 1. Employee Name & Contact */}
                      <td>
                        <div className="cell-name">
                          <div className="avatar">{initials(r.name)}</div>
                          <div>
                            <div className="cell-name-text" style={{ fontWeight: 600 }}>{r.name}</div>
                            {r.email ? (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                                {r.email}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic', marginTop: 1 }}>
                                No email configured
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Code & Department */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="cell-code" style={{ alignSelf: 'flex-start' }}>{r.employee_code}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {r.department || 'General'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Status Badge & Scan Time */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {isPresent && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--green-muted)',
                                color: 'var(--green)',
                                border: '1px solid var(--green-border)',
                                alignSelf: 'flex-start',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <CheckCircle2 size={13} /> Present
                            </span>
                          )}
                          {isAbsent && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--red-muted)',
                                color: 'var(--red)',
                                border: '1px solid var(--red-border)',
                                alignSelf: 'flex-start',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <XCircle size={13} /> Absent
                            </span>
                          )}
                          {isNotMarked && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-default)',
                                alignSelf: 'flex-start',
                                fontWeight: 600,
                              }}
                            >
                              ⏳ Not Marked
                            </span>
                          )}

                          {r.last_scan_time && (
                            <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                              Time: <strong style={{ color: 'var(--text-secondary)' }}>{r.last_scan_time}</strong>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Action Buttons (ONLY Present & Absent - NO OUT) */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {isNotMarked && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => handleDirectMark(r, 'IN')}
                                disabled={isBusy}
                                title={`Mark ${r.name} Present for ${selectedDate}`}
                                style={{
                                  background: 'var(--green-muted)',
                                  color: 'var(--green)',
                                  border: '1px solid var(--green-border)',
                                  fontWeight: 600,
                                }}
                              >
                                <CheckCircle2 size={13} />
                                {isBusy ? 'Saving…' : 'Mark Present'}
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => handleDirectMark(r, 'ABSENT')}
                                disabled={isBusy}
                                title={`Mark ${r.name} Absent for ${selectedDate}`}
                                style={{
                                  background: 'var(--red-muted)',
                                  color: 'var(--red)',
                                  border: '1px solid var(--red-border)',
                                  fontWeight: 600,
                                }}
                              >
                                <XCircle size={13} />
                                {isBusy ? 'Saving…' : 'Mark Absent'}
                              </button>
                            </>
                          )}

                          {isPresent && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDirectMark(r, 'ABSENT')}
                                disabled={isBusy}
                                title={`Change ${r.name} status to Absent`}
                                style={{
                                  color: 'var(--red)',
                                  border: '1px solid var(--red-border)',
                                }}
                              >
                                <XCircle size={13} />
                                {isBusy ? 'Saving…' : 'Change to Absent'}
                              </button>
                            </>
                          )}

                          {isAbsent && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleDirectMark(r, 'IN')}
                                disabled={isBusy}
                                title={`Change ${r.name} status to Present`}
                                style={{
                                  color: 'var(--green)',
                                  border: '1px solid var(--green-border)',
                                }}
                              >
                                <CheckCircle2 size={13} />
                                {isBusy ? 'Saving…' : 'Change to Present'}
                              </button>
                            </>
                          )}

                          {/* Options icon to open custom time / note modal */}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setModalEmp(r);
                              setModalScanType(isPresent ? 'IN' : isAbsent ? 'ABSENT' : 'IN');
                              setModalTime('');
                              setModalNote('');
                            }}
                            title="Set custom time or add admin note"
                            style={{ padding: '6px 9px' }}
                          >
                            <SlidersHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Custom Time & Note Entry ── */}
      {modalEmp && (
        <div
          className="modal-backdrop"
          onClick={() => setModalEmp(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              maxWidth: 460,
              width: '100%',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              animation: 'modalIn 0.2s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Detailed Entry: {modalEmp.name}
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Date: {dateLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setModalEmp(null)}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit}>
              <div className="field" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Attendance Status
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setModalScanType('IN')}
                    style={{
                      background: modalScanType === 'IN' ? 'var(--green)' : 'var(--bg-tertiary)',
                      color: modalScanType === 'IN' ? '#fff' : 'var(--text-secondary)',
                      border: modalScanType === 'IN' ? '1px solid var(--green)' : '1px solid var(--border-default)',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={15} /> Present
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setModalScanType('ABSENT')}
                    style={{
                      background: modalScanType === 'ABSENT' ? 'var(--red)' : 'var(--bg-tertiary)',
                      color: modalScanType === 'ABSENT' ? '#fff' : 'var(--text-secondary)',
                      border: modalScanType === 'ABSENT' ? '1px solid var(--red)' : '1px solid var(--border-default)',
                      fontWeight: 600,
                    }}
                  >
                    <XCircle size={15} /> Absent
                  </button>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Specific Time <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional — auto if blank)</span>
                </label>
                <input
                  type="time"
                  step="1"
                  value={modalTime}
                  onChange={e => setModalTime(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                  Reason / Note <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  value={modalNote}
                  onChange={e => setModalNote(e.target.value)}
                  placeholder="e.g. On-duty, Forgot Card, Approved Leave"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalEmp(null)}
                  disabled={modalSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSubmitting}
                >
                  {modalSubmitting ? 'Saving…' : `Confirm ${modalScanType === 'ABSENT' ? 'Absent' : 'Present'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
