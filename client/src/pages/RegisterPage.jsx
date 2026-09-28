import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    studentId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, register } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(form);
      navigate('/login', {
        replace: true,
        state: { message: 'Account created. Sign in with your new email and password.' },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to register. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold text-slate-900">Create a student account</div>
          <p className="mt-2 text-sm text-slate-500">Register to use the campus portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              className="input"
              autoComplete="name"
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="register-email">Email</label>
            <input
              id="register-email"
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
            <label className="label" htmlFor="register-student-id">Student ID (optional)</label>
            <input
              id="register-student-id"
              className="input"
              maxLength={50}
              value={form.studentId}
              onChange={(event) => setForm({ ...form, studentId: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="register-phone">Phone (optional)</label>
            <input
              id="register-phone"
              className="input"
              type="tel"
              autoComplete="tel"
              maxLength={30}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className="input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Use 8–72 characters.</p>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-semibold text-blue-600">Login</Link>
        </p>
      </section>
    </main>
  );
}
