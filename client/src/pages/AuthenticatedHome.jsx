import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthenticatedHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">Authenticated session</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome, {user.name}</h1>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-500">Email</dt>
            <dd className="mt-1 text-slate-800">{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Role</dt>
            <dd className="mt-1 capitalize text-slate-800">{user.role}</dd>
          </div>
          {user.student_id && (
            <div>
              <dt className="font-medium text-slate-500">Student ID</dt>
              <dd className="mt-1 text-slate-800">{user.student_id}</dd>
            </div>
          )}
        </dl>
        <button type="button" className="btn-primary mt-8" onClick={handleLogout}>
          Logout
        </button>
        {user.role === 'student' && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <Link className="btn-primary" to="/student/complaints">
              My Complaints
            </Link>
            <Link className="btn-secondary" to="/student/complaints/new">
              Create Complaint
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
