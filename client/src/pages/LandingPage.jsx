import { ArrowRight, BellRing, ClipboardList, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  { title: 'Quick submission', text: 'Students can log issues in a few clicks with category, location, and upload support.', icon: ClipboardList },
  { title: 'Role-based workflow', text: 'Support staff and admins manage complaints with transparent lifecycle tracking.', icon: Users },
  { title: 'Secure access', text: 'JWT-based authentication keeps every user role protected and auditable.', icon: ShieldCheck },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-2xl font-bold">CampusCare</div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10">Login</Link>
          <Link to="/register" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-100">Register</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-blue-100">
            <BellRing size={12} /> complaint management
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">Campus complaints made simple.</h1>
          <p className="mt-5 max-w-xl text-lg text-blue-100">
            Track student issues, assign staff, update statuses, and generate actionable reports for every campus department.
          </p>
          <div className="mt-8 flex gap-4">
            <Link to="/register" className="flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-semibold text-blue-700 hover:bg-slate-100">
              Create account <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="rounded-lg border border-white/30 px-5 py-3 font-semibold hover:bg-white/10">Login</Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm">
          <div className="rounded-2xl bg-white p-5 text-slate-800">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Overview</div>
                <div className="text-xl font-bold">This month</div>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">+18.2%</div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-blue-50 p-4">
                <div className="text-xs text-slate-500">Total</div>
                <div className="mt-2 text-2xl font-bold text-blue-700">128</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <div className="text-xs text-slate-500">Open</div>
                <div className="mt-2 text-2xl font-bold text-amber-700">41</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="text-xs text-slate-500">Resolved</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">87</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map(({ title, text, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="mb-4 inline-flex rounded-xl bg-white/10 p-3">
                <Icon size={22} />
              </div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-blue-100">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
