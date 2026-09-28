import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const homePathForRole = {
  student: '/student/complaints',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to={homePathForRole[user.role] || '/login'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user: authenticatedUser } = await login(form.email, form.password);
      navigate(homePathForRole[authenticatedUser.role] || '/login', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-slate-900">CampusCare</div>
          <h1 className="mt-2 text-sm text-slate-500">Sign in to your account</h1>
        </div>

        {location.state?.message && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
            {location.state.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              maxLength={72}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Don’t have an account? <Link to="/register" className="font-semibold text-blue-600">Register</Link>
        </p>

        <div className="mt-4 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          Campus staff member?{' '}
          <Link to="/staff/login" className="font-semibold text-blue-600 hover:underline">
            Staff Portal Login →
          </Link>
        </div>
      </section>
    </main>
  );
}
