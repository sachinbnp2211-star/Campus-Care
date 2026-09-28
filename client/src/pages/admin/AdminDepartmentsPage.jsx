import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (signal) => {
    const { data } = await api.get('/admin/departments', { signal });
    setDepartments(data.departments || []);
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load departments.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/departments', form);
      setForm({ name: '', description: '' });
      setSuccess('Department created.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create department.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/admin/departments/${editingId}`, editing);
      setEditingId(null);
      setSuccess('Department updated.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Administration</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Manage Departments</h1>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{success}</div>}

      <form onSubmit={submit} className="card p-5 space-y-4">
        <div>
          <label className="label">Department name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add department'}</button>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-4 py-6 text-center text-slate-600" colSpan="3">Loading departments…</td></tr>
            ) : departments.map((dept) => (
              <tr key={dept.id} className="border-b border-slate-200 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {editingId === dept.id ? (
                    <input className="input" value={editing.name} maxLength={100} onChange={(event) => setEditing({ ...editing, name: event.target.value })} aria-label="Department name" />
                  ) : dept.name}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {editingId === dept.id ? (
                    <input className="input" value={editing.description} maxLength={2000} onChange={(event) => setEditing({ ...editing, description: event.target.value })} aria-label="Department description" />
                  ) : dept.description || '—'}
                </td>
                <td className="px-4 py-3">
                  {editingId === dept.id ? (
                    <form className="flex gap-2" onSubmit={saveEdit}>
                      <button className="btn-primary" type="submit" disabled={saving}>Save</button>
                      <button className="btn-secondary" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <button className="btn-secondary" type="button" onClick={() => { setEditingId(dept.id); setEditing({ name: dept.name, description: dept.description || '' }); }}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
