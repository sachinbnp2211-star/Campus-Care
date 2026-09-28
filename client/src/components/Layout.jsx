import {
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  UserCircle2,
  ShieldCheck,
  Users,
  Building2,
  Tags,
  FileText,
  UserCheck,
  Bell,
  BarChart3,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navConfig = {
  student: [
    { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/student/complaints', label: 'My Complaints', icon: FileText },
    { to: '/student/complaints/new', label: 'Submit Complaint', icon: MessageSquareText },
    { to: '/student/notifications', label: 'Notifications', icon: Bell },
    { to: '/student/profile', label: 'Profile', icon: UserCircle2 },
  ],
  staff: [
    { to: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/profile', label: 'Profile', icon: UserCircle2 },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/complaints', label: 'All Complaints', icon: FileText },
    { to: '/admin/reports', label: 'Reports & Trends', icon: BarChart3 },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/categories', label: 'Categories', icon: Tags },
    { to: '/admin/staff', label: 'Staff Management', icon: UserCheck },
    { to: '/admin/users', label: 'Users', icon: Users },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navConfig[user?.role] || [];

  const handleLogout = () => {
    const isStaff = user?.role === 'staff';
    logout();
    navigate(isStaff ? '/staff/login' : '/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <aside className="hidden w-72 flex-col bg-slate-900 p-5 text-slate-100 md:flex">
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-lg font-bold">CampusCare</div>
            <div className="text-xs text-slate-300">
              {user?.role === 'staff'
                ? 'Staff Portal'
                : user?.role === 'admin'
                ? 'Admin Portal'
                : 'Complaint System'}
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-xl bg-slate-800 p-4 text-sm text-slate-200">
          <div className="font-semibold">{user?.name}</div>
          <div className="mt-1 capitalize text-slate-300">{user?.role}</div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Campus Portal</div>
            <div className="text-lg font-semibold text-slate-800">Complaint Management</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 md:block">
              {user?.email}
            </div>
            <button className="btn-secondary" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </button>
          </div>
        </header>

        <nav
          className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 md:hidden"
          aria-label="Main navigation"
        >
          {items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
