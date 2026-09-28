import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MapPin,
  Paperclip,
  Phone,
  Send,
  ShieldAlert,
  User,
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function StaffComplaintDetailsPage() {
  const { id } = useParams();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Status update form state
  const [selectedStatus, setSelectedStatus] = useState('');
  const [remark, setRemark] = useState('');

  const loadComplaintDetails = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/staff/complaints/${id}`, { signal });
      setDetails(data);
      // Default to the first available next status if available
      if (data.allowedNextStatuses && data.allowedNextStatuses.length > 0) {
        setSelectedStatus(data.allowedNextStatuses[0]);
      } else {
        setSelectedStatus('');
      }
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setError(requestError.response?.data?.message || 'Could not load complaint details.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    loadComplaintDetails(controller.signal);
    return () => controller.abort();
  }, [loadComplaintDetails]);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Please select a target status.');
      return;
    }

    // Require a remark when resolving or closing
    const requiresRemark = ['Resolved', 'Closed'].includes(selectedStatus);
    if (requiresRemark && !remark.trim()) {
      setError(
        `A resolution remark is required when marking a complaint as "${selectedStatus}". Please describe the outcome.`
      );
      return;
    }

    setUpdating(true);
    setError('');
    setActionSuccess('');

    try {
      const payload = {
        status: selectedStatus,
      };
      if (remark.trim()) {
        payload.remark = remark.trim();
      }

      await api.patch(`/staff/complaints/${id}/status`, payload);
      setActionSuccess(`Complaint status successfully updated to "${selectedStatus}".`);
      setRemark('');

      // Reload fresh details & history from backend
      const controller = new AbortController();
      await loadComplaintDetails(controller.signal);
    } catch (updateError) {
      setError(updateError.response?.data?.message || 'Failed to update complaint status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    setDownloadingId(attachment.id);
    setError('');
    try {
      const { data } = await api.get(attachment.url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (downloadError) {
      setError(downloadError.response?.data?.message || 'Could not download attachment.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500" role="status">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm font-medium">Loading complaint details…</p>
      </div>
    );
  }

  if (!details || !details.complaint) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="card p-8 text-center text-slate-600">Complaint not found or not assigned to you.</div>
        )}
        <div>
          <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            <ArrowLeft size={16} />
            <span>Back to Staff Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  const { complaint, history = [], attachments = [], allowedNextStatuses = [] } = details;
  const isUrgent = complaint.priority === 'Urgent';
  const isHigh = complaint.priority === 'High';
  const hasNextActions = allowedNextStatuses.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/staff/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>
        <span className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
          ID: #{complaint.id}
        </span>
      </div>

      {/* Header Banner */}
      <div className={`card p-6 md:p-8 ${isUrgent ? 'border-l-4 border-l-red-500' : isHigh ? 'border-l-4 border-l-amber-500' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {complaint.complaint_number}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  <ShieldAlert size={14} /> Urgent
                </span>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-bold text-slate-900 sm:text-3xl">
              {complaint.title}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Assigned to you · Category:{' '}
              <span className="font-semibold text-slate-700">{complaint.category_name}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={complaint.priority} />
            <StatusBadge label={complaint.status} />
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Grid: Details on Left / Status Action on Right */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Complaint Information */}
        <div className="space-y-6 lg:col-span-2">
          {/* Detailed Info Card */}
          <div className="card p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <span>Complaint Overview</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500">Complaint Number</span>
                <span className="mt-0.5 font-mono font-medium text-slate-800">{complaint.complaint_number}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Category</span>
                <span className="mt-0.5 font-medium text-slate-800">{complaint.category_name || 'General'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Assigned Department</span>
                <span className="mt-0.5 inline-flex items-center gap-1 font-medium text-slate-800">
                  <Building2 size={14} className="text-slate-400" />
                  {complaint.department_name || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Location</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-slate-800">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  {complaint.location || '—'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Date Submitted</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
                  <Calendar size={14} className="text-slate-400" />
                  {complaint.created_at ? new Date(complaint.created_at).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Last Updated</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
                  <Clock size={14} className="text-slate-400" />
                  {complaint.updated_at ? new Date(complaint.updated_at).toLocaleString() : '—'}
                </span>
              </div>
              {complaint.resolved_at && (
                <div className="sm:col-span-2">
                  <span className="block text-xs font-semibold text-slate-500">Resolved Date</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {new Date(complaint.resolved_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-slate-100 pt-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detailed Description
              </span>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-200">
                {complaint.description}
              </p>
            </div>
          </div>

          {/* Student Info Card */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <User size={18} className="text-blue-600" />
              <span>Student Information</span>
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-500">Student Name</span>
                <span className="mt-0.5 font-medium text-slate-800">{complaint.student_name || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Student ID / Roll No</span>
                <span className="mt-0.5 font-mono text-slate-700">{complaint.student_id || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-500">Contact Phone</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-slate-700">
                  <Phone size={13} className="text-slate-400" />
                  {complaint.student_phone || 'Not provided'}
                </span>
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Paperclip size={18} className="text-blue-600" />
                <span>Attachments ({attachments.length})</span>
              </span>
            </h2>
            {attachments.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {attachments.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                      <Paperclip size={16} className="text-slate-400 shrink-0" />
                      <span className="truncate max-w-xs sm:max-w-md">{file.file_name}</span>
                      {file.created_at && (
                        <span className="text-xs text-slate-400">
                          ({new Date(file.created_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={downloadingId === file.id}
                      onClick={() => handleDownloadAttachment(file)}
                      className="btn-secondary inline-flex items-center gap-1.5 py-1 px-3 text-xs"
                    >
                      <Download size={13} />
                      <span>{downloadingId === file.id ? 'Downloading…' : 'Download'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-slate-400 italic">No files attached to this complaint.</p>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Action Form & History */}
        <div className="space-y-6">
          {/* Status Update Action Card */}
          <div className="card p-6 border-t-4 border-t-blue-600">
            <h2 className="text-lg font-bold text-slate-900">Take Action</h2>
            <p className="mt-1 text-xs text-slate-500">
              Update the progress or resolution of this complaint.
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
              <span className="font-semibold text-slate-600">Current Status:</span>{' '}
              <span className="font-bold text-slate-900">{complaint.status}</span>
            </div>

            {hasNextActions ? (
              <form onSubmit={handleStatusUpdate} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="staff-status-select" className="block text-xs font-semibold text-slate-700 mb-1">
                    Transition to Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="staff-status-select"
                    className="input text-sm"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    required
                  >
                    {allowedNextStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="staff-action-remark" className="block text-xs font-semibold text-slate-700">
                      {['Resolved', 'Closed'].includes(selectedStatus)
                        ? <><span>Resolution Remark</span><span className="ml-1 text-red-500">*</span></>  
                        : 'Action Remark / Note'}
                    </label>
                    <span className="text-[11px] text-slate-400">{remark.length}/2000</span>
                  </div>
                  <textarea
                    id="staff-action-remark"
                    rows={4}
                    maxLength={2000}
                    className="input text-sm placeholder-slate-400"
                    placeholder={
                      ['Resolved', 'Closed'].includes(selectedStatus)
                        ? 'Required — Describe the resolution: what was found, what was done, outcome...'
                        : 'Provide details about actions taken, reason for status update...'
                    }
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    required={['Resolved', 'Closed'].includes(selectedStatus)}
                  />
                  {['Resolved', 'Closed'].includes(selectedStatus) && !remark.trim() && (
                    <p className="mt-1 text-[11px] text-amber-600">A resolution remark is required to close this complaint.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={updating || !selectedStatus}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm"
                >
                  {updating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving status…</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Update Status</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="mt-4 rounded-lg bg-slate-100 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Terminal Status</p>
                <p className="mt-1">
                  This complaint is marked as <span className="font-bold">{complaint.status}</span>. No further forward status changes are permitted by staff.
                </p>
              </div>
            )}
          </div>

          {/* Status History Timeline Card */}
          <div className="card p-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Status History ({history.length})
            </h2>

            {history.length > 0 ? (
              <ol className="mt-4 space-y-4">
                {history.map((entry, index) => (
                  <li key={entry.id || index} className="relative pl-5 border-l-2 border-blue-400 pb-2">
                    <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-white" />
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <StatusBadge label={entry.new_status} />
                      <time className="text-[11px] text-slate-400">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                      </time>
                    </div>
                    <div className="mt-1.5 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{entry.changed_by_name}</span>
                      {entry.previous_status && (
                        <span className="text-slate-400">
                          {' '}(changed from <span className="font-medium text-slate-600">{entry.previous_status}</span>)
                        </span>
                      )}
                    </div>
                    {entry.remark && (
                      <div className="mt-1.5 rounded bg-slate-50 p-2 text-xs text-slate-700 border border-slate-200">
                        {entry.remark}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-xs text-slate-400 italic">No status transitions recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
