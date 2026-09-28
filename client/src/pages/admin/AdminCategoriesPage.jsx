import { useEffect, useState } from 'react';
import api from '../../services/api';

const initialForm = {
  name: '',
  description: '',
  departmentId: '',
  isActive: true,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (signal) => {
    const [catRes, deptRes] = await Promise.all([
      api.get('/admin/categories', { signal }),
      api.get('/admin/departments', { signal }),
    ]);
    setCategories(catRes.data.categories || []);
    setDepartments(deptRes.data.departments || []);
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal)
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load categories or departments.');
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
      await api.post('/admin/categories', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        isActive: form.isActive,
      });
      setForm(initialForm);
      setSuccess('Category created successfully.');
      const controller = new AbortController();
      await loadData(controller.signal);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create category.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditing({
      name: cat.name || '',
      description: cat.description || '',
      departmentId: cat.department_id ? String(cat.department_id) : '',
      isActive: Boolean(cat.is_active ?? true),
    });
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditing(initialForm);
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/admin/categories/${editingId}`, {
        name: editing.name.trim(),
        description: editing.description.trim() || undefined,
        departmentId: editing.departmentId ? Number(editing.departmentId) : null,
        isActive: editing.isActive,
      });
      setEditingId(null);
      setSuccess('Category updated successfully.');
      const controller = new AbortController();
      await loadData(controller.signal);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">Administration</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Manage Categories</h1>
        <p className="mt-1 text-slate-600 text-sm">
          Map complaint categories to responsible departments and manage category status.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {success}
        </div>
      )}

      {/* Add New Category Form */}
      <form onSubmit={submit} className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 border-b pb-2 border-slate-100">Add New Category</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label font-medium text-slate-700" htmlFor="cat-name">Category Name *</label>
            <input
              id="cat-name"
              className="input mt-1"
              value={form.name}
              maxLength={100}
              placeholder="e.g. Transportation, Electrical..."
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label font-medium text-slate-700" htmlFor="cat-dept">Responsible Department</label>
            <select
              id="cat-dept"
              className="input mt-1"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Not Assigned (No Department)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label font-medium text-slate-700" htmlFor="cat-desc">Description</label>
          <textarea
            id="cat-desc"
            rows={2}
            className="input mt-1"
            maxLength={2000}
            placeholder="Optional details on what issues belong to this category..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Active Category</span>
          </label>

          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add category'}
          </button>
        </div>
      </form>

      {/* Categories Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left divide-y divide-slate-200">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Responsible Department</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-600" colSpan="5">
                    Loading categories…
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-600" colSpan="5">
                    No categories found.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  return (
                    <tr key={cat.id} className={isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50/80 transition-colors'}>
                      {isEditing ? (
                        <td colSpan="5" className="p-4">
                          <form onSubmit={saveEdit} className="space-y-3 bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Category Name</label>
                                <input
                                  className="input mt-1"
                                  value={editing.name}
                                  maxLength={100}
                                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                  required
                                  aria-label="Category name"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Responsible Department</label>
                                <select
                                  className="input mt-1"
                                  value={editing.departmentId}
                                  onChange={(e) => setEditing({ ...editing, departmentId: e.target.value })}
                                  aria-label="Responsible department"
                                >
                                  <option value="">Not Assigned</option>
                                  {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Status</label>
                                <select
                                  className="input mt-1"
                                  value={editing.isActive ? 'Active' : 'Inactive'}
                                  onChange={(e) => setEditing({ ...editing, isActive: e.target.value === 'Active' })}
                                  aria-label="Category status"
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Description</label>
                              <textarea
                                rows={2}
                                className="input mt-1"
                                maxLength={2000}
                                value={editing.description}
                                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                aria-label="Category description"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                              <button className="btn-secondary" type="button" onClick={cancelEdit}>
                                Cancel
                              </button>
                              <button className="btn-primary" type="submit" disabled={saving}>
                                {saving ? 'Saving…' : 'Save Changes'}
                              </button>
                            </div>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {cat.name}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {cat.department_name ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {cat.department_name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm max-w-xs truncate">
                            {cat.description || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                cat.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {cat.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="btn-secondary text-xs py-1 px-3"
                              type="button"
                              onClick={() => startEdit(cat)}
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
