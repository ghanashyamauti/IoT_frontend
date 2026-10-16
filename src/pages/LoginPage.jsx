import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, AlertCircle, Sun, Moon } from 'lucide-react';
import * as api from '../api';
import { BASE_PATH } from '../config';

export default function LoginPage({ onLoginSuccess, theme, toggleTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.login(email.trim(), password, rememberMe);
      if (data?.access_token) {
        onLoginSuccess(data.user, data.access_token);
      } else {
        setError('Authentication response missing access token.');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      {/* Ambient background glow elements */}
      <div className="login-ambient-glow" />
      <div className="login-ambient-glow-secondary" />

      {/* Top right theme toggle */}
      <div className="login-top-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <div className="login-container">
        <div className="login-card glass-panel">
          {/* Logo & Header */}
          <div className="login-header">
            <div className="login-logo-glow">
              <img
                src={`${BASE_PATH}shakham_logo.png`}
                alt="Shakham Logo"
                className="login-logo-image"
              />
            </div>
            <h1 className="login-title">
              Shakham <span>Attendance</span>
            </h1>
            <p className="login-subtitle">
              Admin Management Portal & RFID Console
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="login-alert error-shake">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {/* Email Field */}
            <div className="login-field-group">
              <label htmlFor="admin-email" className="login-label">
                Admin Email Address
              </label>
              <div className="login-input-wrap">
                <Mail size={18} className="input-icon" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  required
                  autoFocus
                  className="login-input"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="login-field-group">
              <label htmlFor="admin-password" className="login-label">
                Password
              </label>
              <div className="login-input-wrap">
                <Lock size={18} className="input-icon" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  className="btn-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Options Row */}
            <div className="login-options-row">
              <label className="login-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="login-checkbox"
                />
                <span>Remember this session</span>
              </label>
              <span className="session-badge">24h JWT</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`login-submit-btn ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="login-footer">
            <ShieldCheck size={13} className="footer-shield" />
            <span>Secured with JWT 256-bit AES Token Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}
