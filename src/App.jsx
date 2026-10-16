import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, CalendarDays, BarChart3, Users, Sun, Moon, Menu, LogOut, UserCheck } from 'lucide-react';
import { useClock, useTheme, useToast, useInterval } from './hooks';
import { formatDate } from './utils';
import { rfidSerial } from './rfidSerial';
import * as api from './api';

import TodayPage            from './pages/TodayPage';
import DirectAttendancePage from './pages/DirectAttendancePage';
import HistoryPage          from './pages/HistoryPage';
import ReportsPage          from './pages/ReportsPage';
import EmployeesPage        from './pages/EmployeesPage';
import LoginPage            from './pages/LoginPage';
import { BASE_PATH }        from './config';

const PAGES = [
  { id: 'today',    label: 'Today',             icon: LayoutDashboard },
  { id: 'direct',   label: 'Direct Attendance', icon: UserCheck       },
  { id: 'history',  label: 'History',           icon: CalendarDays    },
  { id: 'reports',  label: 'Reports',           icon: BarChart3       },
  { id: 'employees',label: 'Employees',         icon: Users           },
];

export default function App() {
  const [token, setToken] = useState(() => api.getStoredToken());
  const [currentUser, setCurrentUser] = useState(() => api.getStoredUser());
  const [page, setPage] = useState('today');
  const [backendOnline, setBackendOnline] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // USB Serial state
  const [usbConnected, setUsbConnected] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const clock = useClock();
  const { theme, toggle: toggleTheme } = useTheme();
  const { toasts, addToast } = useToast();

  // Ensure the browser URL reflects the configured BASE_PATH
  useEffect(() => {
    const cleanBase = BASE_PATH.replace(/\/+$/, '');
    if (!window.location.pathname.startsWith(cleanBase)) {
      window.history.replaceState(null, '', BASE_PATH);
    }
  }, []);

  // Listen for logout / unauthorized events
  useEffect(() => {
    function handleLogout() {
      setToken(null);
      setCurrentUser(null);
      setShowLogoutModal(false);
      // Ensure the base path is preserved in browser address bar when logging out
      const cleanBase = BASE_PATH.replace(/\/+$/, '');
      if (!window.location.pathname.startsWith(cleanBase)) {
        window.history.replaceState(null, '', BASE_PATH);
      }
    }
    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleLogout);
    };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && showLogoutModal) {
        setShowLogoutModal(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLogoutModal]);

  // ── Load employees ──
  const loadEmployees = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.fetchEmployees();
      setEmployees(data);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadEmployees();
    }
  }, [token, loadEmployees]);
  useInterval(loadEmployees, 15000);

  // ── Health check ──
  useInterval(async () => {
    const ok = await api.checkBackendHealth();
    setBackendOnline(ok);
  }, 30000);

  // ── USB Serial ──
  useEffect(() => {
    if (!token || !rfidSerial.isSupported()) return;

    const unsub = rfidSerial.onStatusChange((connected, msg) => {
      setUsbConnected(connected);
      if (connected) {
        addToast('USB RFID Reader connected at 115200 baud!', 'ok');
      } else if (msg && msg !== 'Disconnected') {
        addToast(msg, 'inf');
      }
    });

    return unsub;
  }, [token, addToast]);

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

  // ── Unauthenticated view: Render Login Page ──
  if (!token) {
    return (
      <>
        <LoginPage
          theme={theme}
          toggleTheme={toggleTheme}
          onLoginSuccess={(user, newToken) => {
            setToken(newToken);
            setCurrentUser(user);
            addToast(`Welcome, ${user.name || 'Admin'}!`, 'ok');
          }}
        />
        <div className="toasts-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              <span>{t.type === 'ok' ? '✅' : t.type === 'err' ? '❌' : 'ℹ️'}</span>
              <span>{t.msg}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ── Page title ──
  const pageMeta = PAGES.find(p => p.id === page);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrap">
            <img src={`${BASE_PATH}shakham_logo.png`} alt="Shakham" className="sidebar-logo-img" />
          </div>
          <div className="sidebar-brand-text">
            Shakham <span>Attendance</span>
          </div>
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
          {/* Admin User Card with Sign Out */}
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {currentUser?.name
                ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                : 'AD'}
            </div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{currentUser?.name || 'Administrator'}</span>
              <span className="sidebar-user-email">{currentUser?.email || 'Admin'}</span>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={() => setShowLogoutModal(true)}
              title="Sign out of Admin session"
            >
              <LogOut size={15} />
            </button>
          </div>

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
                className="theme-toggle hamburger-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
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

            <button
              className="btn-topbar-logout"
              onClick={() => setShowLogoutModal(true)}
              title="Sign out of Admin session"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        <div className="page-content">
          {page === 'today' && (
            <TodayPage
              toast={addToast}
              employees={employees}
              loadEmployees={loadEmployees}
              rfidSerial={rfidSerial}
            />
          )}
          {page === 'direct' && (
            <DirectAttendancePage
              toast={addToast}
              employees={employees}
              loadEmployees={loadEmployees}
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
        </div>
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
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="modal-backdrop-blur"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="logout-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="logout-dialog-icon">
              <LogOut size={26} />
            </div>

            <h3 className="logout-dialog-title">Sign Out of Admin Portal?</h3>
            <p className="logout-dialog-desc">
              Are you sure you want to end your current session? You will need to enter your admin credentials to log back in.
            </p>

            {currentUser?.email && (
              <div className="logout-user-pill">
                <span>Active account:</span>
                <strong>{currentUser.email}</strong>
              </div>
            )}

            <div className="logout-dialog-actions">
              <button
                type="button"
                className="btn-cancel-logout"
                onClick={() => setShowLogoutModal(false)}
              >
                Stay Logged In
              </button>
              <button
                type="button"
                className="btn-confirm-logout"
                onClick={() => {
                  setShowLogoutModal(false);
                  api.logout();
                  addToast('Signed out of Admin session', 'inf');
                }}
              >
                <LogOut size={15} />
                <span>Yes, Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
