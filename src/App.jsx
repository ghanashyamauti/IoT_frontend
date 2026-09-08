import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, CalendarDays, BarChart3, Users, Hand, Sun, Moon, Menu, X } from 'lucide-react';
import { useClock, useTheme, useToast, useInterval } from './hooks';
import { formatDate } from './utils';
import { rfidSerial } from './rfidSerial';
import * as api from './api';

import TodayPage     from './pages/TodayPage';
import HistoryPage   from './pages/HistoryPage';
import ReportsPage   from './pages/ReportsPage';
import EmployeesPage from './pages/EmployeesPage';
import ManualPage    from './pages/ManualPage';

const PAGES = [
  { id: 'today',    label: 'Today',    icon: LayoutDashboard },
  { id: 'manual',   label: 'Manual',   icon: Hand            },
  { id: 'history',  label: 'History',  icon: CalendarDays    },
  { id: 'reports',  label: 'Reports',  icon: BarChart3       },
  { id: 'employees',label: 'Employees',icon: Users           },
];

export default function App() {
  const [page, setPage] = useState('today');
  const [backendOnline, setBackendOnline] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // USB Serial state
  const [usbConnected, setUsbConnected] = useState(false);

  const clock = useClock();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toasts, addToast } = useToast();

  // ── Load employees ──
  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.fetchEmployees();
      setEmployees(data);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useInterval(loadEmployees, 15000);

  // ── Health check ──
  useInterval(async () => {
    const ok = await api.checkBackendHealth();
    setBackendOnline(ok);
  }, 30000);

  // ── USB Serial ──
  useEffect(() => {
    if (!rfidSerial.isSupported()) return;

    const unsub = rfidSerial.onStatusChange((connected, msg) => {
      setUsbConnected(connected);
      if (connected) {
        addToast('USB RFID Reader connected at 115200 baud!', 'ok');
      } else if (msg && msg !== 'Disconnected') {
        addToast(msg, 'inf');
      }
    });

    return unsub;
  }, [addToast]);

  async function toggleUsb() {
    if (!rfidSerial.isSupported()) {
      addToast('Web Serial not supported. Use Chrome or Edge.', 'err');
      return;
    }
    if (rfidSerial.isConnected) {
      await rfidSerial.disconnect();
      addToast('USB Reader disconnected', 'inf');
    } else {
      try {
        const ok = await rfidSerial.connect();
        if (!ok) addToast('Port selection cancelled', 'inf');
      } catch (err) {
        addToast('Connection error: ' + err.message, 'err');
      }
    }
  }

  // ── Page title ──
  const pageMeta = PAGES.find(p => p.id === page);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrap">
            <img src="/shakham_logo.png" alt="Shakham" className="sidebar-logo-img" />
          </div>
          <div className="sidebar-brand-text">
            Shakham <span>Attendance</span>
          </div>
          {/* Mobile close */}
          <button
            className="theme-toggle"
            style={{ marginLeft: 'auto', display: 'none' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {PAGES.map(p => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className={`nav-link ${page === p.id ? 'active' : ''}`}
                onClick={() => { setPage(p.id); setSidebarOpen(false); }}
              >
                <Icon size={18} />
                {p.label}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className={`chip ${backendOnline ? 'online' : 'offline'}`}>
            <div className="chip-dot"></div>
            {backendOnline ? 'Backend Online' : 'Backend Offline'}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Mobile hamburger */}
              <button
                className="theme-toggle"
                style={{ display: 'none' }}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={16} />
              </button>
              <div>
                <h2>{pageMeta?.label || 'Dashboard'}</h2>
                <div className="breadcrumb">{formatDate(new Date())}</div>
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <button
              className={`btn-usb ${usbConnected ? 'connected' : ''} ${!rfidSerial.isSupported() ? 'unsupported' : ''}`}
              onClick={toggleUsb}
              title={!rfidSerial.isSupported() ? 'Web Serial not supported' : 'Connect USB RFID Reader'}
            >
              <span>{usbConnected ? '🟢' : '🔌'}</span>
              <span>{usbConnected ? 'USB: Connected' : 'Connect USB'}</span>
            </button>

            <div className="clock-chip">{clock}</div>

            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        {page === 'today' && (
          <TodayPage
            toast={addToast}
            employees={employees}
            loadEmployees={loadEmployees}
            rfidSerial={rfidSerial}
          />
        )}
        {page === 'manual' && (
          <ManualPage
            employees={employees}
            onRefreshEmployees={loadEmployees}
            rfidSerial={rfidSerial}
            toast={addToast}
          />
        )}
        {page === 'history' && (
          <HistoryPage toast={addToast} />
        )}
        {page === 'reports' && (
          <ReportsPage toast={addToast} />
        )}
        {page === 'employees' && (
          <EmployeesPage
            toast={addToast}
            employees={employees}
            loadEmployees={loadEmployees}
          />
        )}
      </main>

      {/* Toasts */}
      <div className="toasts-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'ok' ? '✅' : t.type === 'err' ? '❌' : 'ℹ️'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 199, display: 'none'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar .sidebar-brand button { display: flex !important; }
          .topbar-left button { display: flex !important; }
          .topbar-right .btn-usb span:last-child { display: none; }
          .sidebar + div { display: block !important; }
        }
      `}</style>
    </div>
  );
}
