import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function StaffLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { user, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Already authenticated user redirection
  if (user) {
    if (user.role === 'staff') {
      return <Navigate to="/staff/dashboard" replace />;
    } else if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else {
      return (
        <Navigate
          to="/student/complaints"
          replace
          state={{ message: 'Staff portal is restricted to staff members.' }}
        />
      );
    }
  }

  const validateForm = () => {
    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      setError('Staff email is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid staff email address.');
      return false;
    }
    if (!form.password) {
      setError('Password is required.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await login(form.email.trim(), form.password);
      const authenticatedUser = response.user;

      // Strict role verification: only 'staff' allowed in Staff Portal
      if (authenticatedUser.role !== 'staff') {
        logout();
        setError('This account does not have staff portal access. Please use the appropriate portal.');
        return;
      }

      // Preserve intended staff destination if user was redirected from a protected route
      const destination =
        location.state?.from?.pathname?.startsWith('/staff') &&
        location.state?.from?.pathname !== '/staff/login'
          ? location.state.from.pathname
          : '/staff/dashboard';

      navigate(destination, { replace: true });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        setError('Invalid email or password.');
      } else if (requestError.response?.status === 503) {
        setError('Unable to connect to the authentication server. Please check MySQL and server status.');
      } else {
        setError(requestError.response?.data?.message || 'Unable to sign in. Please verify your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      {/* Background radial accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-950/40 via-slate-950 to-slate-950" />

      {/* Main Login Card */}
      <section className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
        {/* Institutional Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">
            Institutional Access
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            CampusCare
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Staff Complaint Management Portal
          </p>
        </div>

        {/* Location-state notification if redirected */}
        {location.state?.message && !error && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-300" role="alert">
            {location.state.message}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300" role="alert">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="staff-login-email">
              Staff Email
            </label>
            <input
              id="staff-login-email"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="staff@campus.edu"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300" htmlFor="staff-login-password">
                Password
              </label>
              <button
                type="button"
                className="text-xs text-blue-400 transition hover:text-blue-300 hover:underline"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                id="staff-login-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={72}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Signing in…</span>
              </span>
            ) : (
              'Sign In as Staff'
            )}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-800 pt-5 text-xs text-slate-400">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={14} />
            <span>Back to CampusCare</span>
          </Link>
          <div className="text-slate-500">
            Student or general user?{' '}
            <Link to="/login" className="font-semibold text-blue-400 transition hover:underline">
              Student Login
            </Link>
          </div>
        </div>
      </section>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-semibold text-white" id="modal-title">
                <HelpCircle size={18} className="text-blue-400" />
                <span>Reset Staff Password</span>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:text-white"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Staff accounts are managed by the campus administration and IT department. If you have forgotten your password or need your credentials reset, please contact:
            </p>
            <div className="mt-3 rounded-lg bg-slate-950 p-3 text-xs border border-slate-800 space-y-1">
              <div className="font-medium text-slate-200">Campus IT Helpdesk</div>
              <div className="text-slate-400">Email: it-admin@campus.edu</div>
              <div className="text-slate-400">Extension: 4357 (HELP)</div>
            </div>
            <button
              type="button"
              className="btn-primary mt-4 w-full text-xs"
              onClick={() => setShowForgotModal(false)}
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
