import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const statuses = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];
const filtersDefault = { search: '', status: '', priority: '', category: '', department: '' };

export default function AdminComplaintsPage() {
  const [filters, setFilters] = useState(filtersDefault);
  const [page, setPage] = useState(1);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadComplaints = useCallback(async (signal) => {
    const parameters = Object.fromEntries(
      Object.entries({ ...filters, page, limit: 10 }).filter(([, value]) => value !== '')
    );
    const { data } = await api.get('/admin/complaints', { params: parameters, signal });
    setComplaints(data.complaints || []);
    setPagination(data.pagination);
    setEdits({});
  }, [filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    loadComplaints(controller.signal)
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load complaints.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadComplaints]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get('/admin/categories', { signal: controller.signal }),
      api.get('/admin/departments', { signal: controller.signal }),
      api.get('/admin/staff?status=Active', { signal: controller.signal }),
    ])
      .then(([categoryResponse, departmentResponse, staffResponse]) => {
        setCategories(categoryResponse.data.categories || []);
        setDepartments(departmentResponse.data.departments || []);
        setStaff(staffResponse.data.staff || []);
      })
      .catch((requestError) => {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load complaint assignment options.');
        }
      });
    return () => controller.abort();
  }, []);

  const setComplaintField = (complaint, field, value) => {
    setEdits((current) => ({
      ...current,
      [complaint.id]: { ...current[complaint.id], [field]: value },
    }));
  };

  const valueFor = (complaint, field, original) =>
    edits[complaint.id]?.[field] ?? original ?? '';

  const saveComplaint = async (complaint) => {
    const edit = edits[complaint.id] || {};
    setSavingId(complaint.id);
    setError('');
    setSuccess('');
    try {
      await api.patch(`/admin/complaints/${complaint.id}`, {
        status: edit.status ?? complaint.status,
        priority: edit.priority ?? complaint.priority,
        departmentId: edit.departmentId !== undefined
          ? (edit.departmentId || null)
          : (complaint.assigned_department_id || null),
        staffId: edit.staffId !== undefined
          ? (edit.staffId || null)
          : (complaint.assigned_staff_id || null),
      });
      setSuccess(`${complaint.complaint_number} updated.`);
      const controller = new AbortController();
      await loadComplaints(controller.signal);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this complaint.');
    } finally {
      setSavingId(null);
    }
  };

  const updateFilter = (event) => {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
    setPage(1);
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Administration</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">All Complaints</h1>
        <p className="mt-2 text-slate-600">Review, assign, and update campus complaints.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{success}</div>}

      <div className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <input
          className="input xl:col-span-2"
          name="search"
          value={filters.search}
          onChange={updateFilter}
          placeholder="Search complaint, student, or email"
          maxLength={100}
          aria-label="Search complaints"
        />
        <select className="input" name="status" value={filters.status} onChange={updateFilter} aria-label="Filter by status">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className="input" name="priority" value={filters.priority} onChange={updateFilter} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {priorities.map((priority) => <option key={priority}>{priority}</option>)}
        </select>
        <select className="input" name="category" value={filters.category} onChange={updateFilter} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="input" name="department" value={filters.department} onChange={updateFilter} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={() => { setFilters(filtersDefault); setPage(1); }}>
          Reset filters
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="card p-8 text-center text-slate-600" role="status">Loading complaints…</div>
        ) : complaints.length === 0 ? (
          <div className="card p-10 text-center text-slate-600">No complaints match these filters.</div>
        ) : complaints.map((complaint) => {
          const selectedDepartment = valueFor(complaint, 'departmentId', complaint.assigned_department_id);
          const eligibleStaff = staff.filter(
            (member) => String(member.department_id || '') === String(selectedDepartment || '')
          );
          return (
            <article key={complaint.id} className="card space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-700">{complaint.complaint_number}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{complaint.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {complaint.student_name} · {complaint.student_email} · {complaint.category_name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={complaint.status} />
                  <StatusBadge label={complaint.priority} />
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{complaint.description}</p>
              <p className="text-xs text-slate-500">
                {complaint.location} · Submitted {new Date(complaint.created_at).toLocaleString()}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-slate-600">
                  Status
                  <select
                    className="input mt-1"
                    value={valueFor(complaint, 'status', complaint.status)}
                    onChange={(event) => setComplaintField(complaint, 'status', event.target.value)}
                  >
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Priority
                  <select
                    className="input mt-1"
                    value={valueFor(complaint, 'priority', complaint.priority)}
                    onChange={(event) => setComplaintField(complaint, 'priority', event.target.value)}
                  >
                    {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Department
                  <select
                    className="input mt-1"
                    value={selectedDepartment}
                    onChange={(event) => {
                      setComplaintField(complaint, 'departmentId', event.target.value);
                      setComplaintField(complaint, 'staffId', '');
                    }}
                  >
                    <option value="">Unassigned</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-600">
                  Staff
                  <select
                    className="input mt-1"
                    value={valueFor(complaint, 'staffId', complaint.assigned_staff_id)}
                    onChange={(event) => setComplaintField(complaint, 'staffId', event.target.value)}
                    disabled={!selectedDepartment}
                  >
                    <option value="">Unassigned</option>
                    {eligibleStaff.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => saveComplaint(complaint)}
                  disabled={savingId === complaint.id}
                >
                  {savingId === complaint.id ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && pagination.totalPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} complaints
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <button className="btn-secondary" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
