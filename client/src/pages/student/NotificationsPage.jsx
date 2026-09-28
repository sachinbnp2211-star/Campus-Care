import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import api from '../../services/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = async (signal) => {
    try {
      const { data } = await api.get('/notifications', { signal });
      setNotifications(data.notifications || []);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') {
        setError(err.response?.data?.message || 'Could not load notifications.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadNotifications(controller.signal);
    return () => controller.abort();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: 1 } : item))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    setActionLoading(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const hasUnread = notifications.some((item) => !item.is_read);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500 font-semibold">Updates</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Notifications</h1>
        </div>
        {hasUnread && (
          <button
            type="button"
            className="btn-secondary text-sm flex items-center gap-1.5"
            onClick={markAllAsRead}
            disabled={actionLoading}
          >
            <CheckCheck className="w-4 h-4 text-slate-600" />
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-slate-600">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 space-y-3">
          <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <p className="font-medium text-slate-700">No notifications yet</p>
          <p className="text-sm text-slate-500">You will receive updates here when your complaint status changes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const isUnread = !item.is_read;
            return (
              <div
                key={item.id}
                className={`card p-5 transition-all ${
                  isUnread ? 'border-l-4 border-l-blue-600 bg-blue-50/20 shadow-sm' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{item.title}</span>
                      {isUnread && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.message}</p>
                    <p className="text-xs text-slate-400 pt-1">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors title='Mark as read'"
                      onClick={() => markAsRead(item.id)}
                      aria-label="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
