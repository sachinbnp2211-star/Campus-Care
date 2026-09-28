export default function StatCard({ title, value, subtitle, accent = 'blue' }) {
  const accentClass = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  }[accent];

  return (
    <div className="card p-5">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${accentClass}`}>{title}</div>
      <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
      {subtitle && <div className="mt-2 text-sm text-slate-500">{subtitle}</div>}
    </div>
  );
}
