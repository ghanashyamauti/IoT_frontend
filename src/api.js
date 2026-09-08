import { BACKEND_URL } from './config';

// ── API helper ────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res;
}

// ── Employees ─────────────────────────────────────────────────────────
export async function fetchEmployees() {
  const res = await api('/employees');
  return res.json();
}

export async function fetchEmployee(id) {
  const res = await api(`/employees/${id}`);
  return res.json();
}

export async function addEmployee({ name, employee_code, department }) {
  const res = await api('/employees', {
    method: 'POST',
    body: JSON.stringify({ name, employee_code, department }),
  });
  return res.json();
}

export async function updateEmployee(id, data) {
  const res = await api(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteEmployee(id) {
  const res = await api(`/employees/${id}`, { method: 'DELETE' });
  return res.json();
}

// ── Attendance ────────────────────────────────────────────────────────
export async function fetchAttendanceToday() {
  const res = await api('/attendance/today');
  return res.json();
}

export async function fetchAttendanceByDate(dateStr) {
  const res = await api(`/attendance/history?date=${dateStr}`);
  return res.json();
}

export async function fetchAttendanceRange(from, to) {
  const res = await api(`/attendance/range?from=${from}&to=${to}`);
  return res.json();
}

export async function fetchAttendanceSummary(month) {
  const res = await api(`/attendance/summary?month=${month}`);
  return res.json();
}

export function getExportUrl(from, to) {
  return `${BACKEND_URL}/attendance/export?from=${from}&to=${to}`;
}

// ── Scan (from USB Web Serial) ────────────────────────────────────────
export async function sendScan(uid) {
  const res = await api('/scan', {
    method: 'POST',
    body: JSON.stringify({ uid }),
  });
  return res.json();
}

// ── Enrollment ────────────────────────────────────────────────────────
export async function startEnrollment(employee_id) {
  const res = await api('/enroll/start', {
    method: 'POST',
    body: JSON.stringify({ employee_id }),
  });
  return res.json();
}

export async function getEnrollResult() {
  const res = await api('/enroll/result');
  return res.json();
}

export async function enrollLink(employee_id, uid) {
  const res = await api('/enroll/link', {
    method: 'POST',
    body: JSON.stringify({ employee_id, uid }),
  });
  return res.json();
}

// ── Cards ─────────────────────────────────────────────────────────────
export async function deactivateCard({ uid, employee_id }) {
  const res = await api('/cards/deactivate', {
    method: 'POST',
    body: JSON.stringify({ uid, employee_id }),
  });
  return res.json();
}

// ── Manual Attendance (one-card-tap-per-employee flow) ─────────────────
export async function startManualAttend(employee_id) {
  const res = await api('/manual/start', {
    method: 'POST',
    body: JSON.stringify({ employee_id }),
  });
  return res.json();
}

export async function getManualStatus() {
  const res = await api('/manual/status');
  return res.json();
}

export async function cancelManualAttend() {
  const res = await api('/manual/cancel', { method: 'POST' });
  return res.json();
}

export async function markAttendanceDirect(employee_id) {
  const res = await api('/attendance/mark', {
    method: 'POST',
    body: JSON.stringify({ employee_id }),
  });
  return res.json();
}

// ── Health check ──────────────────────────────────────────────────────
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
