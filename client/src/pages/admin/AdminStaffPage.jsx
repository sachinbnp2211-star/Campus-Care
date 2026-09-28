import { useEffect, useState, useId } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  Mail,
  Pencil,
  Phone,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import api from '../../services/api';

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resettingStaff, setResettingStaff] = useState(null);

  // Forms state
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    departmentId: '',
    phone: '',
    status: 'Active',
  });
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState('');

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    departmentId: '',
    phone: '',
    status: 'Active',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);
  const [resetError, setResetError] = useState('');

  const [togglingId, setTogglingId] = useState(null);

  // Fetch departments and staff
  const loadData = async (signal) => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (departmentFilter) params.departmentId = departmentFilter;
      if (statusFilter) params.status = statusFilter;

      const [staffRes, deptRes] = await Promise.all([
        api.get('/admin/staff', { params, signal }),
        api.get('/admin/departments', { signal }),
      ]);
      setStaffList(staffRes.data.staff || []);
      setDepartments(deptRes.data.departments || []);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.message || 'Could not load staff data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [search, departmentFilter, statusFilter]);

  // Handle Add Staff
  const handleOpenAdd = () => {
    setAddForm({
      name: '',
      email: '',
      password: '',
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      phone: '',
      status: 'Active',
    });
    setAddError('');
    setShowAddPassword(false);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('Full name, email, and password are required.');
      return;
    }
    if (addForm.password.length < 8) {
      setAddError('Password must be at least 8 characters long.');
      return;
    }

    setSubmittingAdd(true);
    try {
      const payload = {
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        password: addForm.password,
        phone: addForm.phone.trim() || null,
        departmentId: addForm.departmentId ? Number(addForm.departmentId) : null,
        status: addForm.status,
      };

      const res = await api.post('/admin/staff', payload);
      setSuccess(`Staff account for ${res.data.staff.name} created successfully.`);
      setIsAddOpen(false);
      loadData();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create staff account.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Edit Staff
  const handleOpenEdit = (staff) => {
    setEditingStaff(staff);
    setEditForm({
      name: staff.name,
      email: staff.email,
      departmentId: staff.department_id ? String(staff.department_id) : '',
      phone: staff.phone || '',
      status: staff.status || 'Active',
    });
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Full name and email are required.');
      return;
    }

    setSubmittingEdit(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
        status: editForm.status,
      };

      const res = await api.put(`/admin/staff/${editingStaff.id}`, payload);
      setSuccess(`Staff account for ${res.data.staff.name} updated successfully.`);
      setEditingStaff(null);
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update staff account.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async (staff) => {
    const nextStatus = staff.status === 'Active' ? 'Inactive' : 'Active';
    setTogglingId(staff.id);
    setError('');
    setSuccess('');

    try {
      await api.patch(`/admin/staff/${staff.id}/status`, { status: nextStatus });
      setSuccess(`Staff account "${staff.name}" is now ${nextStatus}.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change staff status.');
    } finally {
      setTogglingId(null);
    }
  };

  // Handle Reset Password
  const handleOpenReset = (staff) => {
    setResettingStaff(staff);
    setResetForm({ password: '', confirmPassword: '' });
    setShowResetPassword(false);
    setResetError('');
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!resetForm.password || resetForm.password.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }
    if (resetForm.password !== resetForm.confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    setSubmittingReset(true);
    try {
      await api.patch(`/admin/staff/${resettingStaff.id}/password`, {
        password: resetForm.password,
      });
      setSuccess(`Password for ${resettingStaff.name} has been reset successfully.`);
      setResettingStaff(null);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setSubmittingReset(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDepartmentFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(search || departmentFilter || statusFilter);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            Administration
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Staff Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, assign, configure, and monitor campus department staff accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-2 shadow-sm"
          id="btn-add-staff"
        >
          <UserPlus size={18} />
          <span>+ Add Staff</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm"
          role="alert"
        >
          <AlertCircle size={20} className="shrink-0 text-red-600" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            className="text-red-500 hover:text-red-700"
            onClick={() => setError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm"
          role="status"
        >
          <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
          <div className="flex-1">{success}</div>
          <button
            type="button"
            className="text-emerald-500 hover:text-emerald-700"
            onClick={() => setSuccess('')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-12 md:items-center">
          {/* Search Input */}
          <div className="relative md:col-span-6 lg:col-span-5">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              id="staff-search-input"
              className="input pl-10"
              placeholder="Search staff by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search staff"
            />
          </div>

          {/* Department Filter */}
          <div className="md:col-span-3 lg:col-span-3">
            <select
              id="staff-dept-filter"
              className="input"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Department filter"
            >
              <option value="">Department ▼ (All)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3 lg:col-span-2">
            <select
              id="staff-status-filter"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status filter"
            >
              <option value="">Status ▼ (All)</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="md:col-span-12 lg:col-span-2">
              <button
                type="button"
                onClick={clearFilters}
                className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500" role="status">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span>Loading staff accounts…</span>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center text-slate-500" role="status">
            <Users size={40} className="mx-auto mb-3 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-800">No staff members found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {hasActiveFilters
                ? 'Try adjusting your search query or department/status filters.'
                : 'No staff accounts exist yet. Click "+ Add Staff" above to create one.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="btn-secondary mt-4 text-xs"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Department
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Created
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="transition hover:bg-slate-50/70">
                    {/* Name + Avatar */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
                          {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{staff.name}</div>
                          {staff.phone && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone size={12} />
                              <span>{staff.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">
                      {staff.email}
                    </td>

                    {/* Department */}
                    <td className="whitespace-nowrap px-5 py-4">
                      {staff.department_name ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-100">
                          <Building2 size={13} />
                          {staff.department_name}
                        </span>
                      ) : (
                        <span className="text-xs italic text-slate-400">Unassigned</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                        {staff.role}
                      </span>
                    </td>

                    {/* Account Status */}
                    <td className="whitespace-nowrap px-5 py-4">
                      {staff.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {staff.created_at
                        ? new Date(staff.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(staff)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit Staff Member"
                          aria-label={`Edit ${staff.name}`}
                        >
                          <Pencil size={15} />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenReset(staff)}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                          title="Reset Password"
                          aria-label={`Reset password for ${staff.name}`}
                        >
                          <Key size={15} />
                        </button>

                        {/* Status Toggle (Activate/Deactivate) */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(staff)}
                          disabled={togglingId === staff.id}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition flex items-center gap-1 ${
                            staff.status === 'Active'
                              ? 'border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                          title={staff.status === 'Active' ? 'Deactivate staff account' : 'Activate staff account'}
                          aria-label={`${staff.status === 'Active' ? 'Deactivate' : 'Activate'} ${staff.name}`}
                        >
                          <Power size={13} className={staff.status === 'Active' ? 'text-slate-400' : 'text-emerald-600'} />
                          <span>
                            {togglingId === staff.id
                              ? 'Updating…'
                              : staff.status === 'Active'
                              ? 'Deactivate'
                              : 'Activate'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: ADD STAFF ================= */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-staff-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 id="add-staff-title" className="text-lg font-bold text-slate-900">
                    Add New Staff Member
                  </h2>
                  <p className="text-xs text-slate-500">
                    Account will be created strictly with the Staff role.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {addError && (
              <div
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="add-staff-name">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-staff-name"
                  type="text"
                  className="input"
                  placeholder="e.g. Robert Smith"
                  maxLength={100}
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="add-staff-email">
                  Staff Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-staff-email"
                  type="email"
                  className="input"
                  placeholder="e.g. staff.smith@campus.edu"
                  maxLength={254}
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="add-staff-password">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="add-staff-password"
                    type={showAddPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min 8 characters"
                    minLength={8}
                    maxLength={72}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowAddPassword((prev) => !prev)}
                    aria-label={showAddPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Provide credentials directly to the staff member. Staff can log in at /staff/login.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="add-staff-department">
                    Assigned Department
                  </label>
                  <select
                    id="add-staff-department"
                    className="input"
                    value={addForm.departmentId}
                    onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                  >
                    <option value="">No Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="add-staff-phone">
                    Phone (Optional)
                  </label>
                  <input
                    id="add-staff-phone"
                    type="tel"
                    className="input"
                    placeholder="e.g. 9876543210"
                    maxLength={30}
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="add-staff-status">
                    Initial Status
                  </label>
                  <select
                    id="add-staff-status"
                    className="input"
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                  >
                    <option value="Active">Active (Can authenticate)</option>
                    <option value="Inactive">Inactive (Deactivated)</option>
                  </select>
                </div>

                <div>
                  <span className="label">System Role</span>
                  <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                    <ShieldCheck size={16} className="mr-1.5 text-blue-600" />
                    staff (Fixed)
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddOpen(false)}
                  disabled={submittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  id="btn-submit-add-staff"
                  disabled={submittingAdd}
                >
                  {submittingAdd ? 'Creating account…' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT STAFF ================= */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Pencil size={20} />
                </div>
                <div>
                  <h2 id="edit-staff-title" className="text-lg font-bold text-slate-900">
                    Edit Staff Member
                  </h2>
                  <p className="text-xs text-slate-500">
                    Update profile, department assignment, and active status.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="edit-staff-name">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-staff-name"
                  type="text"
                  className="input"
                  maxLength={100}
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label" htmlFor="edit-staff-email">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-staff-email"
                  type="email"
                  className="input"
                  maxLength={254}
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="edit-staff-department">
                    Assigned Department
                  </label>
                  <select
                    id="edit-staff-department"
                    className="input"
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                  >
                    <option value="">No Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="edit-staff-phone">
                    Phone Number
                  </label>
                  <input
                    id="edit-staff-phone"
                    type="tel"
                    className="input"
                    placeholder="—"
                    maxLength={30}
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="edit-staff-status">
                  Account Status
                </label>
                <select
                  id="edit-staff-status"
                  className="input"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="Active">Active (Can authenticate & resolve complaints)</option>
                  <option value="Inactive">Inactive (Access disabled)</option>
                </select>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Need to change password?</span> Use the dedicated
                "Reset Password" action in the staff table.
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingStaff(null)}
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingEdit}
                >
                  {submittingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESET PASSWORD ================= */}
      {resettingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Key size={20} />
                </div>
                <div>
                  <h2 id="reset-password-title" className="text-lg font-bold text-slate-900">
                    Reset Staff Password
                  </h2>
                  <p className="text-xs text-slate-500">
                    {resettingStaff.name} ({resettingStaff.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResettingStaff(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {resetError && (
              <div
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="reset-new-password">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min 8 characters"
                    minLength={8}
                    maxLength={72}
                    value={resetForm.password}
                    onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="reset-confirm-password">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="reset-confirm-password"
                  type={showResetPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="Repeat new password"
                  minLength={8}
                  maxLength={72}
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <p className="text-xs text-slate-500">
                Staff member must use this new password next time they sign in at /staff/login.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setResettingStaff(null)}
                  disabled={submittingReset}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingReset}
                >
                  {submittingReset ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
