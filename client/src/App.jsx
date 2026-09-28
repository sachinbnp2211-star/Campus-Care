import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthenticatedHome from './pages/AuthenticatedHome';
import SubmitComplaintPage from './pages/student/SubmitComplaintPage';
import MyComplaintsPage from './pages/student/MyComplaintsPage';
import ComplaintDetailsPage from './pages/student/ComplaintDetailsPage';
import StudentDashboard from './pages/student/StudentDashboard';
import NotificationsPage from './pages/student/NotificationsPage';

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminComplaintsPage = lazy(() => import('./pages/admin/AdminComplaintsPage'));
const AdminStaffPage = lazy(() => import('./pages/admin/AdminStaffPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminDepartmentsPage = lazy(() => import('./pages/admin/AdminDepartmentsPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'));
const StaffLoginPage = lazy(() => import('./pages/staff/StaffLoginPage'));
const StaffComplaintDetailsPage = lazy(() => import('./pages/staff/StaffComplaintDetailsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));

function RoleHomeRedirect() {
  const { user } = useAuth();
  const destination =
    user?.role === 'student'
      ? '/student/dashboard'
      : user?.role === 'admin'
      ? '/admin/dashboard'
      : user?.role === 'staff'
      ? '/staff/dashboard'
      : '/';
  return <Navigate to={destination} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/home" element={<RoleHomeRedirect />} />
      </Route>

      {/* Student Routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/student/home" element={<AuthenticatedHome />} />
        <Route element={<Layout />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/complaints/new" element={<SubmitComplaintPage />} />
          <Route path="/student/complaints" element={<MyComplaintsPage />} />
          <Route path="/student/complaints/:id" element={<ComplaintDetailsPage />} />
          <Route path="/student/notifications" element={<NotificationsPage />} />
          <Route path="/student/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Staff Routes */}
      <Route element={<ProtectedRoute allowedRoles={['staff']} redirectTo="/staff/login" />}>
        <Route path="/staff/home" element={<Navigate to="/staff/dashboard" replace />} />
        <Route element={<Layout />}>
          <Route path="/staff/dashboard" element={<StaffDashboard />} />
          <Route path="/staff/assigned" element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="/staff/complaints" element={<Navigate to="/staff/dashboard" replace />} />
          <Route path="/staff/complaints/:id" element={<StaffComplaintDetailsPage />} />
          <Route path="/staff/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/home" element={<Navigate to="/admin/dashboard" replace />} />
        <Route element={<Layout />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/staff" element={<AdminStaffPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <main
              className="flex min-h-screen items-center justify-center bg-slate-100 p-6 font-medium text-slate-600"
              role="status"
            >
              Loading page…
            </main>
          }
        >
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
