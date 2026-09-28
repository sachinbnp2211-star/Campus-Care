import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Calendar,
  Filter,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

const initialFilters = {
  search: '',
  status: '',
  priority: '',
  category: '',
  startDate: '',
  endDate: '',
  sort: 'newest',
};

const sortMapping = {
  newest: { sortBy: 'created_at', sortOrder: 'desc' },
  oldest: { sortBy: 'created_at', sortOrder: 'asc' },
  priority: { sortBy: 'priority', sortOrder: 'desc' },
  last_updated: { sortBy: 'updated_at', sortOrder: 'desc' },
};

export default function StaffDashboard() {
  const { user } = useAuth();

  // Dashboard Stats State
  const [statsData, setStatsData] = useState({
    summary: {},
    department: null,
    departmentSummary: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // Categories State
  const [categories, setCategories] = useState([]);

  // Complaints List & Filter State
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [complaintsError, setComplaintsError] = useState('');

  // 1. Fetch Dashboard Stats
  const loadDashboardStats = useCallback(async (signal) => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const { data } = await api.get('/staff/dashboard', { signal });
      setStatsData({
        summary: data.summary || {},
        department: data.department || null,
        departmentSummary: data.department_summary || null,
      });
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') {
        setStatsError(err.response?.data?.message || 'Unable to load dashboard statistics.');
      }
    } finally {
      if (!signal?.aborted) setStatsLoading(false);
    }
  }, []);

  // 2. Fetch Categories
  const loadCategories = useCallback(async (signal) => {
    try {
      const { data } = await api.get('/staff/categories', { signal });
      setCategories(data.categories || []);
    } catch {
      // Non-critical, filter option can fall back to empty
    }
  }, []);

  // 3. Fetch Assigned Complaints
  const loadComplaints = useCallback(async (signal) => {
    setComplaintsLoading(true);
    setComplaintsError('');

    const sortConfig = sortMapping[filters.sort] || sortMapping.newest;
    const params = {
      page,
      limit: 10,
      sortBy: sortConfig.sortBy,
      sortOrder: sortConfig.sortOrder,
    };

    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.category) params.category = filters.category;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    try {
      const { data } = await api.get('/staff/complaints', { params, signal });
      setComplaints(data.complaints || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') {
        setComplaintsError(err.response?.data?.message || 'Unable to load complaints list.');
      }
    } finally {
      if (!signal?.aborted) setComplaintsLoading(false);
    }
  }, [filters, page]);

  // Initial load
  useEffect(() => {
    const controller = new AbortController();
    loadDashboardStats(controller.signal);
    loadCategories(controller.signal);
    return () => controller.abort();
  }, [loadDashboardStats, loadCategories]);

  // Reload complaints on filter or page change
  useEffect(() => {
    const controller = new AbortController();
    loadComplaints(controller.signal);
    return () => controller.abort();
  }, [loadComplaints]);

  // Filter change handlers
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setSearchInput('');
    setPage(1);
  };

  const summary = statsData.summary;

  return (
    <div className="space-y-6">
      {/* Header with Title and Department badge */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Staff Portal</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Staff Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Here is your assigned complaint overview.
          </p>
        </div>

        {statsData.department && (
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900 shadow-sm">
            <Building2 size={18} className="text-blue-600" />
            <div>
              <span className="font-medium text-blue-700">Department:</span>{' '}
              <span className="font-semibold">{statsData.department.name}</span>
              {statsData.departmentSummary && (
                <span className="ml-2 text-xs text-blue-600">
                  ({statsData.departmentSummary.total} dept total)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Error Alert */}
      {statsError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{statsError}</span>
          </div>
          <button
            type="button"
            className="text-xs font-semibold underline hover:text-red-900"
            onClick={() => loadDashboardStats()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <section aria-label="Complaint Statistics">
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6" role="status">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-28 animate-pulse bg-slate-200 p-5" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Total Assigned"
              value={summary.total_assigned ?? 0}
              subtitle="All assignments"
              accent="blue"
            />
            <StatCard
              title="New / Actionable"
              value={(summary.submitted || 0) + (summary.assigned || 0)}
              subtitle="Pending review"
              accent="amber"
            />
            <StatCard
              title="In Progress"
              value={summary.in_progress ?? 0}
              subtitle="Under active work"
              accent="slate"
            />
            <StatCard
              title="Resolved"
              value={summary.resolved ?? 0}
              subtitle="Completed tasks"
              accent="green"
            />
            <StatCard
              title="High Priority"
              value={summary.high_priority ?? 0}
              subtitle="Needs prompt action"
              accent="amber"
            />
            <StatCard
              title="Urgent"
              value={summary.urgent_priority ?? 0}
              subtitle="Critical campus issues"
              accent="rose"
            />
          </div>
        )}
      </section>

      {/* Complaints List Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Assigned Complaints</h2>
          <p className="text-sm text-slate-500">
            Search, filter, and track issues assigned to you.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="card space-y-3 p-4 md:p-5">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="complaint-search-input"
                type="text"
                className="input pl-10"
                placeholder="Search by complaint #, student, student ID, category, location, or description..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                maxLength={100}
                aria-label="Search assigned complaints"
              />
            </div>
            <button type="submit" className="btn-primary flex items-center gap-1.5 px-4">
              <Search size={16} />
              <span>Search</span>
            </button>
          </form>

          {/* Filter Row */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {/* Status Filter */}
            <div>
              <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-slate-600">
                Status
              </label>
              <select
                id="filter-status"
                className="input text-sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label htmlFor="filter-priority" className="mb-1 block text-xs font-medium text-slate-600">
                Priority
              </label>
              <select
                id="filter-priority"
                className="input text-sm"
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label htmlFor="filter-category" className="mb-1 block text-xs font-medium text-slate-600">
                Category
              </label>
              <select
                id="filter-category"
                className="input text-sm"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div>
              <label htmlFor="filter-start-date" className="mb-1 block text-xs font-medium text-slate-600">
                From Date
              </label>
              <div className="relative">
                <input
                  id="filter-start-date"
                  type="date"
                  className="input text-sm"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </div>
            </div>

            {/* To Date */}
            <div>
              <label htmlFor="filter-end-date" className="mb-1 block text-xs font-medium text-slate-600">
                To Date
              </label>
              <div className="relative">
                <input
                  id="filter-end-date"
                  type="date"
                  className="input text-sm"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <label htmlFor="filter-sort" className="mb-1 block text-xs font-medium text-slate-600">
                Sort By
              </label>
              <select
                id="filter-sort"
                className="input text-sm"
                value={filters.sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Priority</option>
                <option value="last_updated">Last updated</option>
              </select>
            </div>
          </div>

          {/* Active Filter Indicators & Reset */}
          {(filters.search || filters.status || filters.priority || filters.category || filters.startDate || filters.endDate || filters.sort !== 'newest') && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-slate-400" />
                <span>Filters active</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800"
              >
                <RotateCcw size={13} />
                <span>Reset all filters</span>
              </button>
            </div>
          )}
        </div>

        {/* Complaints Table Container */}
        <div className="card overflow-hidden">
          {/* Error Banner */}
          {complaintsError && (
            <div className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
              <div className="flex items-center justify-between">
                <span>{complaintsError}</span>
                <button
                  type="button"
                  className="font-semibold underline hover:text-red-900"
                  onClick={() => loadComplaints()}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {complaintsLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-sm">Loading complaints…</p>
            </div>
          ) : complaints.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Search size={22} />
              </div>
              <h3 className="mt-3 font-semibold text-slate-800">No complaints found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {filters.search || filters.status || filters.priority || filters.category || filters.startDate || filters.endDate
                  ? 'No assigned complaints matched your search or filter criteria.'
                  : 'You currently have no complaints assigned to you.'}
              </p>
              {(filters.search || filters.status || filters.priority || filters.category || filters.startDate || filters.endDate) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-secondary mt-4 inline-flex items-center gap-1.5 text-xs"
                >
                  <RotateCcw size={14} />
                  <span>Clear filters</span>
                </button>
              )}
            </div>
          ) : (
            /* Table with Results */
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Complaint</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assigned Staff</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Last Updated</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complaints.map((complaint) => {
                      const isUrgent = complaint.priority === 'Urgent';
                      const isHigh = complaint.priority === 'High';

                      // Visual row highlights for urgent/high priority
                      const rowHighlightClass = isUrgent
                        ? 'border-l-4 border-l-red-500 bg-red-50/40 hover:bg-red-50/70'
                        : isHigh
                        ? 'border-l-4 border-l-amber-400 bg-amber-50/30 hover:bg-amber-50/60'
                        : 'border-l-4 border-l-transparent hover:bg-slate-50';

                      return (
                        <tr key={complaint.id} className={`transition ${rowHighlightClass}`}>
                          {/* Complaint Number & Title */}
                          <td className="px-4 py-3">
                            <Link
                              to={`/staff/complaints/${complaint.id}`}
                              className="group block"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 group-hover:text-blue-600 transition">
                                {isUrgent && (
                                  <ShieldAlert size={15} className="inline text-red-600" title="Urgent Priority" />
                                )}
                                <span>{complaint.complaint_number}</span>
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-xs text-slate-600 group-hover:text-slate-900">
                                {complaint.title}
                              </div>
                            </Link>
                            {complaint.student_name && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                Student: {complaint.student_name}
                                {complaint.student_id ? ` (${complaint.student_id})` : ''}
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {complaint.category_name || 'General'}
                          </td>

                          {/* Location */}
                          <td className="px-4 py-3 text-slate-600">
                            <span className="line-clamp-1">{complaint.location || '—'}</span>
                          </td>

                          {/* Priority Badge */}
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="inline-flex items-center gap-1">
                              <StatusBadge label={complaint.priority} />
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusBadge label={complaint.status} />
                          </td>

                          {/* Assigned Staff */}
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                              {user?.name || 'You'}
                            </span>
                          </td>

                          {/* Created Date */}
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : '—'}
                          </td>

                          {/* Last Updated */}
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {complaint.updated_at ? new Date(complaint.updated_at).toLocaleDateString() : '—'}
                          </td>

                          {/* Action Button */}
                          <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                            <Link
                              to={`/staff/complaints/${complaint.id}`}
                              className="btn-secondary inline-flex items-center gap-1 py-1 px-2.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:border-blue-300"
                            >
                              <span>View & Update</span>
                              <span>→</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span>
                  {pagination.total === 0
                    ? '0 results'
                    : `Showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(
                        pagination.page * pagination.limit,
                        pagination.total
                      )} of ${pagination.total} complaints`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={complaintsLoading || pagination.page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  <span className="text-xs font-medium text-slate-700">
                    Page {pagination.page} of {pagination.totalPages || 1}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={complaintsLoading || pagination.page >= pagination.totalPages}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
