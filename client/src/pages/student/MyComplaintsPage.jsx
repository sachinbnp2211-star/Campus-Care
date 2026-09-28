import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

const initialFilters = {
  search: '',
  status: '',
  category: '',
  department: '',
  priority: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
};

export default function MyComplaintsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    page: Math.max(1, Number(searchParams.get('page')) || 1),
  }));
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/complaints/categories'),
      api.get('/complaints/departments'),
    ])
      .then(([categoryResponse, departmentResponse]) => {
        if (!active) return;
        setCategories(categoryResponse.data.categories || []);
        setDepartments(departmentResponse.data.departments || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load filters.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const parameters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined)
    );

    setLoading(true);
    setError('');
    api.get('/complaints', { params: parameters, signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setComplaints(data.complaints || []);
        setPagination(data.pagination);
      })
      .catch((requestError) => {
        if (!active || requestError.code === 'ERR_CANCELED') return;
        setError(requestError.response?.data?.message || 'Could not load your complaints.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [filters]);

  useEffect(() => {
    const query = filters.page > 1 ? { page: String(filters.page) } : {};
    setSearchParams(query, { replace: true });
  }, [filters.page, setSearchParams]);

  const changeFilter = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value,
      page: 1,
    }));
  };

  const resetFilters = () => setFilters({ ...initialFilters, page: 1 });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Student complaints</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">My Complaints</h1>
        </div>
        <Link className="btn-primary" to="/student/complaints/new">Create complaint</Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="sr-only" htmlFor="complaint-search">Search complaints</label>
          <input
            id="complaint-search"
            className="input"
            name="search"
            value={filters.search}
            onChange={changeFilter}
            placeholder="Search complaint number or title"
            maxLength={100}
          />
        </div>
        <select className="input" name="status" value={filters.status} onChange={changeFilter} aria-label="Filter by status">
          <option value="">All statuses</option>
          {['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select className="input" name="category" value={filters.category} onChange={changeFilter} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
        </select>
        <select className="input" name="department" value={filters.department} onChange={changeFilter} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
        </select>
        <select className="input" name="priority" value={filters.priority} onChange={changeFilter} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {['Low', 'Medium', 'High', 'Urgent'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select className="input" name="sortBy" value={filters.sortBy} onChange={changeFilter} aria-label="Sort complaints by">
          <option value="created_at">Submitted date</option>
          <option value="updated_at">Updated date</option>
          <option value="complaint_number">Complaint number</option>
          <option value="title">Title</option>
          <option value="status">Status</option>
          <option value="priority">Priority</option>
        </select>
        <select className="input" name="sortOrder" value={filters.sortOrder} onChange={changeFilter} aria-label="Sort direction">
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <button type="button" className="btn-secondary" onClick={resetFilters}>Reset filters</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600" role="status">Loading complaints…</div>
        ) : complaints.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="font-semibold text-slate-800">No complaints found</h2>
            <p className="mt-2 text-sm text-slate-500">Try changing the filters or submit a new complaint.</p>
            <Link className="mt-4 inline-flex text-sm font-semibold text-blue-700" to="/student/complaints/new">
              Submit your first complaint
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Complaint</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <tr key={complaint.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-4 py-3">
                        <Link to={`/student/complaints/${complaint.id}`} className="font-semibold text-blue-700 hover:underline">
                          {complaint.complaint_number}
                        </Link>
                        <div className="mt-1 text-sm text-slate-600">{complaint.title}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{complaint.category_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{complaint.department_name || 'Not specified'}</td>
                      <td className="px-4 py-3"><StatusBadge label={complaint.status} /></td>
                      <td className="px-4 py-3"><StatusBadge label={complaint.priority} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{new Date(complaint.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <span>
                {pagination.total === 0 ? '0 results' : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loading || pagination.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  Previous
                </button>
                <span className="self-center">Page {pagination.page} of {pagination.totalPages || 1}</span>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loading || pagination.page >= pagination.totalPages}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
