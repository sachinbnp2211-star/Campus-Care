import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

export default function AdminReportsPage() {
  const [data, setData] = useState({ categoryStats: [], statusStats: [], monthlyStats: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard/admin', { signal: controller.signal });
        setData(data);
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setError(err.response?.data?.message || 'Could not load admin report data.');
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
        <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">Administration</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">Visual breakdown of complaint categories, statuses, and monthly trends.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-slate-600">Loading reports…</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Category Trends</h2>
            <div className="h-72">
              {data.categoryStats?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.categoryStats}>
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No category data available
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Monthly Complaints</h2>
            <div className="h-72">
              {data.monthlyStats?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyStats}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  No monthly trend data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
