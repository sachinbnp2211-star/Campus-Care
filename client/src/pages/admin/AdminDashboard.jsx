import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../../services/api';
import StatCard from '../../components/StatCard';

const colors = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function AdminDashboard() {
  const [data, setData] = useState({ stats: {}, categoryStats: [], statusStats: [], monthlyStats: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get('/admin/dashboard', { signal: controller.signal });
        setData(data);
      } catch (requestError) {
        if (requestError.code !== 'ERR_CANCELED') {
          setError(requestError.response?.data?.message || 'Could not load the admin dashboard.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  if (loading) return <div className="card p-8 text-center text-slate-600" role="status">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Overview</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Admin Dashboard</h1>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total complaints" value={data.stats.total_complaints || 0} accent="blue" />
        <StatCard title="Pending" value={data.stats.pending || 0} accent="amber" />
        <StatCard title="In progress" value={data.stats.in_progress || 0} accent="slate" />
        <StatCard title="Resolved" value={data.stats.resolved || 0} accent="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Complaint distribution by category</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categoryStats}>
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">Complaint status</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.statusStats} dataKey="value" nameKey="name" outerRadius={90} label>
                  {data.statusStats.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
