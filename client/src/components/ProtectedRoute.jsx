import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles, redirectTo }) {
  const { user, loading, initializationError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-slate-600" role="status">Verifying your session…</p>
      </main>
    );
  }

  if (!user) {
    const destination = redirectTo || (allowedRoles?.includes('staff') && allowedRoles.length === 1 ? '/staff/login' : '/login');
    return <Navigate to={destination} replace state={{ message: initializationError, from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.role}/home`} replace />;
  }

  return <Outlet />;
}
