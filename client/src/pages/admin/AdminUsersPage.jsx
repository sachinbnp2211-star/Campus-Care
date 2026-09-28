import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (signal) => {
    const [userResponse, departmentResponse] = await Promise.all([
      api.get('/admin/users', { signal }),
      api.get('/admin/departments', { signal }),
    ]);
    setUsers(userResponse.data.users || []);
    setDepartments(departmentResponse.data.departments || []);
    setEdits({});
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load users.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const updateEdit = (user, field, value) => {
    setEdits((current) => ({
      ...current,
      [user.id]: { ...current[user.id], [field]: value },
    }));
  };

  const save = async (user) => {
    const edit = edits[user.id] || {};
    setSavingId(user.id);
    setError('');
    setSuccess('');
    try {
      await api.put(`/admin/users/${user.id}`, {
        role: edit.role ?? user.role,
        departmentId: edit.departmentId !== undefined
          ? (edit.departmentId || null)
          : (user.department_id || null),
        status: edit.status ?? user.status ?? 'Active',
      });
      setSuccess(`${user.name}'s account was updated.`);
      const controller = new AbortController();
      await load(controller.signal);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this user.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Administration</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Manage Users</h1>
        <p className="mt-2 text-slate-600">Review accounts and manage roles, status, and staff departments.</p>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{success}</div>}
      <div className="card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-600" role="status">Loading users…</div>
        ) : (
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Name / Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const edit = edits[user.id] || {};
                return (
                  <tr key={user.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{user.name}</div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{user.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        className="input min-w-32"
                        value={edit.role ?? user.role}
                        onChange={(event) => updateEdit(user, 'role', event.target.value)}
                        disabled={user.id === currentUser.id || savingId === user.id}
                        aria-label={`Role for ${user.name}`}
                      >
                        {['student', 'staff', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input min-w-40"
                        value={edit.departmentId ?? (user.department_id || '')}
                        onChange={(event) => updateEdit(user, 'departmentId', event.target.value)}
                        aria-label={`Department for ${user.name}`}
                      >
                        <option value="">No department</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>{department.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input min-w-28"
                        value={edit.status ?? user.status ?? 'Active'}
                        onChange={(event) => updateEdit(user, 'status', event.target.value)}
                        aria-label={`Status for ${user.name}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => save(user)}
                        disabled={savingId === user.id || !Object.keys(edit).length}
                      >
                        {savingId === user.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
