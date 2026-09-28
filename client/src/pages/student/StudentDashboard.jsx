import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function StudentDashboard() {
  const [data, setData] = useState({ summary: {}, recentComplaints: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard/student', { signal: controller.signal });
        setData(data);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.message || 'Could not load student dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">Overview</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Student Dashboard</h1>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total complaints" value={loading ? '…' : (data.summary.total || 0)} accent="blue" />
        <StatCard title="Pending" value={loading ? '…' : (data.summary.pending || 0)} accent="amber" />
        <StatCard title="In progress" value={loading ? '…' : (data.summary.in_progress || 0)} accent="slate" />
        <StatCard title="Resolved" value={loading ? '…' : (data.summary.resolved || 0)} accent="green" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Recently submitted complaints</h2>
          <Link to="/student/complaints" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Complaint</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-600" colSpan="4">
                    Loading dashboard data…
                  </td>
                </tr>
              ) : !data.recentComplaints || data.recentComplaints.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan="4">
                    No complaints submitted yet.{' '}
                    <Link to="/student/complaints/new" className="text-blue-600 font-semibold underline">
                      Submit your first complaint
                    </Link>
                  </td>
                </tr>
              ) : (
                data.recentComplaints.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/student/complaints/${item.id}`} className="font-semibold text-slate-800 hover:text-blue-600">
                        {item.title}
                      </Link>
                      <div className="text-xs text-slate-500">{item.complaint_number}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge label={item.status} /></td>
                    <td className="px-4 py-3"><StatusBadge label={item.priority} /></td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{item.location}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
