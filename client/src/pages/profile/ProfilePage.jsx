import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Account</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Profile</h1>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <div className="text-sm text-slate-500">Name</div>
          <div className="mt-1 text-xl font-semibold text-slate-800">{user?.name}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">Email</div>
          <div className="mt-1 text-slate-800">{user?.email}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">Role</div>
          <div className="mt-1 capitalize text-slate-800">{user?.role}</div>
        </div>
        <div>
          <div className="text-sm text-slate-500">Phone</div>
          <div className="mt-1 text-slate-800">{user?.phone || 'Not provided'}</div>
        </div>
      </div>
    </div>
  );
}
