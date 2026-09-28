const palette = {
  // Status colours
  Submitted: 'bg-slate-100 text-slate-700 ring-slate-300',
  'Under Review': 'bg-blue-100 text-blue-700 ring-blue-300',
  Assigned: 'bg-violet-100 text-violet-700 ring-violet-300',
  'In Progress': 'bg-amber-100 text-amber-800 ring-amber-400',
  Resolved: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  Closed: 'bg-green-100 text-green-700 ring-green-300',
  Rejected: 'bg-rose-100 text-rose-700 ring-rose-300',

  // Priority colours — also include a prefix icon/text for non-color accessibility
  Low: 'bg-slate-100 text-slate-600 ring-slate-300',
  Medium: 'bg-yellow-100 text-yellow-800 ring-yellow-300',
  High: 'bg-orange-100 text-orange-800 ring-orange-400',
  Urgent: 'bg-red-100 text-red-800 ring-red-400 font-bold',
};

// Non-color indicator for priorities so the badge is accessible without colour
const priorityPrefix = {
  Low: '↓ ',
  Medium: '– ',
  High: '▲ ',
  Urgent: '⚡ ',
};

export default function StatusBadge({ label }) {
  const prefix = priorityPrefix[label] || '';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${palette[label] || 'bg-slate-100 text-slate-700 ring-slate-300'}`}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {label}
    </span>
  );
}
