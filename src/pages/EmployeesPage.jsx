import { useState } from 'react';
import { Pencil, Trash2, CreditCard, XCircle } from 'lucide-react';
import { initials } from '../utils';
import * as api from '../api';

export default function EmployeesPage({ toast, employees, loadEmployees }) {
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDept, setEditDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  function openEdit(emp) {
    setEditModal(emp);
    setEditName(emp.name);
    setEditCode(emp.employee_code);
    setEditDept(emp.department || '');
  }

  async function handleSaveEdit() {
    if (!editName.trim() || !editCode.trim()) {
      toast('Name and code are required', 'err');
      return;
    }
    setSaving(true);
    try {
      await api.updateEmployee(editModal.id, {
        name: editName.trim(),
        employee_code: editCode.trim(),
        department: editDept.trim(),
      });
      toast(`${editName.trim()} updated!`, 'ok');
      setEditModal(null);
      loadEmployees();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(emp) {
    if (!confirm(`Delete ${emp.name}? This will also remove their attendance records and linked cards.`)) return;
    try {
      await api.deleteEmployee(emp.id);
      toast(`${emp.name} deleted`, 'ok');
      loadEmployees();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  async function handleDeactivateCard(emp) {
    if (!confirm(`Deactivate all cards for ${emp.name}?`)) return;
    try {
      await api.deactivateCard({ employee_id: emp.id });
      toast(`Cards deactivated for ${emp.name}`, 'ok');
      loadEmployees();
    } catch (err) {
      toast(err.message, 'err');
    }
  }

  const filtered = search
    ? employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_code.toLowerCase().includes(search.toLowerCase())
      )
    : employees;

  // Stats
  const withCard = employees.filter(e => e.has_card).length;
  const withoutCard = employees.length - withCard;

  return (
    <>
      {/* Stats */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi" data-color="blue">
          <div className="kpi-header">
            <div className="kpi-label">Total Employees</div>
            <div className="kpi-icon">👥</div>
          </div>
          <div className="kpi-value">{employees.length}</div>
          <div className="kpi-sub">registered in system</div>
        </div>
        <div className="kpi" data-color="green">
          <div className="kpi-header">
            <div className="kpi-label">Card Linked</div>
            <div className="kpi-icon">💳</div>
          </div>
          <div className="kpi-value">{withCard}</div>
          <div className="kpi-sub">ready for scanning</div>
        </div>
        <div className="kpi" data-color="amber">
          <div className="kpi-header">
            <div className="kpi-label">No Card</div>
            <div className="kpi-icon">⚠️</div>
          </div>
          <div className="kpi-value">{withoutCard}</div>
          <div className="kpi-sub">need card enrollment</div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="panel">
        <div className="section-header">
          <div className="section-title">All Employees</div>
          <div className="search-input">
            <input placeholder="Search name or code…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Card Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="5">
                  <div className="empty-state">
                    <div className="icon">👥</div>
                    <p>No employees found.</p>
                  </div>
                </td></tr>
              ) : filtered.map((emp, i) => (
                <tr key={emp.id} style={{ animationDelay: `${i * 20}ms` }}>
                  <td>
                    <div className="cell-name">
                      <div className="avatar">{initials(emp.name)}</div>
                      <span className="cell-name-text">{emp.name}</span>
                    </div>
                  </td>
                  <td><span className="cell-code">{emp.employee_code}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emp.department || '—'}</td>
                  <td>
                    <span className={`tag ${emp.has_card ? 'tag-green' : 'tag-amber'}`}>
                      {emp.has_card ? '✓ Card linked' : '⚠ No card'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(emp)} title="Edit">
                        <Pencil size={13} />
                      </button>
                      {emp.has_card && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivateCard(emp)} title="Deactivate Card" style={{color:'var(--amber)'}}>
                          <CreditCard size={13} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(emp)} title="Delete" style={{color:'var(--red)'}}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Employee — {editModal.name}</div>
            <div className="field">
              <label>Full Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="field">
              <label>Employee Code</label>
              <input value={editCode} onChange={e => setEditCode(e.target.value)} />
            </div>
            <div className="field">
              <label>Department</label>
              <input value={editDept} onChange={e => setEditDept(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
