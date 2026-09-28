import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/StatusBadge';

export default function ComplaintDetailsPage() {
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [edit, setEdit] = useState({
    title: '',
    description: '',
    location: '',
    categoryId: '',
    departmentId: '',
    priority: 'Medium',
  });

  const loadComplaint = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const [detailResponse, categoryResponse, departmentResponse] = await Promise.all([
        api.get(`/complaints/${id}`, { signal }),
        api.get('/complaints/categories', { signal }),
        api.get('/complaints/departments', { signal }),
      ]);
      const complaint = detailResponse.data.complaint;
      setDetails(detailResponse.data);
      setCategories(categoryResponse.data.categories || []);
      setDepartments(departmentResponse.data.departments || []);
      setEdit({
        title: complaint.title,
        description: complaint.description,
        location: complaint.location,
        categoryId: String(complaint.category_id),
        departmentId: complaint.department_id ? String(complaint.department_id) : '',
        priority: complaint.priority,
      });
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
    loadComplaint(controller.signal);
    return () => controller.abort();
  }, [loadComplaint]);

  const saveChanges = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.put(`/complaints/${id}`, {
        ...edit,
        departmentId: edit.departmentId || null,
      });
      setDetails((current) => ({ ...current, complaint: data.complaint }));
      setSuccess('Complaint details updated.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update complaint.');
    } finally {
      setSaving(false);
    }
  };

  const downloadAttachment = async (attachment) => {
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
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not download attachment.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return <div className="card p-8 text-center text-slate-600" role="status">Loading complaint…</div>;
  }
  if (!details) {
    return (
      <div className="space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">{error}</div>}
        <Link to="/student/complaints" className="font-semibold text-blue-700">Back to My Complaints</Link>
      </div>
    );
  }

  const { complaint, history, attachments } = details;
  const canEdit = complaint.status === 'Submitted';

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link to="/student/complaints" className="text-sm font-semibold text-blue-700 hover:underline">
          ← My Complaints
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{complaint.complaint_number}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{complaint.title}</h1>
          </div>
          <StatusBadge label={complaint.status} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{success}</div>}

      <div className="card grid gap-5 p-5 sm:grid-cols-2 md:p-7">
        <Info label="Complaint number" value={complaint.complaint_number} />
        <Info label="Category" value={complaint.category_name} />
        <Info label="Department" value={complaint.department_name || 'Not specified'} />
        <Info label="Priority" value={<StatusBadge label={complaint.priority} />} />
        <Info label="Created" value={new Date(complaint.created_at).toLocaleString()} />
        <Info label="Last updated" value={new Date(complaint.updated_at).toLocaleString()} />
        <div className="sm:col-span-2">
          <div className="text-sm font-medium text-slate-500">Location</div>
          <div className="mt-1 text-slate-800">{complaint.location}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-sm font-medium text-slate-500">Description</div>
          <p className="mt-1 whitespace-pre-wrap text-slate-800">{complaint.description}</p>
        </div>
      </div>

      {canEdit && (
        <details className="card p-5 md:p-7">
          <summary className="cursor-pointer font-semibold text-slate-900">Edit submitted complaint</summary>
          <p className="mt-2 text-sm text-slate-500">Editing is available only before review. Status, owner, and assignment are not editable here.</p>
          <form className="mt-5 space-y-4" onSubmit={saveChanges}>
            <div>
              <label className="label" htmlFor="edit-complaint-title">Title</label>
              <input id="edit-complaint-title" className="input" maxLength={200} value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="edit-complaint-description">Description</label>
              <textarea id="edit-complaint-description" className="input" rows={5} maxLength={10000} value={edit.description} onChange={(event) => setEdit({ ...edit, description: event.target.value })} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="edit-complaint-location">Location</label>
                <input id="edit-complaint-location" className="input" maxLength={200} value={edit.location} onChange={(event) => setEdit({ ...edit, location: event.target.value })} required />
              </div>
              <div>
                <label className="label" htmlFor="edit-complaint-category">Category</label>
                <select id="edit-complaint-category" className="input" value={edit.categoryId} onChange={(event) => setEdit({ ...edit, categoryId: event.target.value })} required>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-complaint-department">Department (optional)</label>
                <select id="edit-complaint-department" className="input" value={edit.departmentId} onChange={(event) => setEdit({ ...edit, departmentId: event.target.value })}>
                  <option value="">Not specified</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-complaint-priority">Priority</label>
                <select id="edit-complaint-priority" className="input" value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value })}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </details>
      )}

      <div className="card p-5 md:p-7">
        <h2 className="text-xl font-bold text-slate-900">Attachments</h2>
        {attachments.length ? (
          <ul className="mt-4 divide-y divide-slate-200">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-sm text-slate-700">{attachment.file_name}</span>
                <button
                  type="button"
                  className="text-sm font-semibold text-blue-700 hover:underline"
                  disabled={downloadingId === attachment.id}
                  onClick={() => downloadAttachment(attachment)}
                >
                  {downloadingId === attachment.id ? 'Downloading…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No attachments.</p>
        )}
      </div>

      <div className="card p-5 md:p-7">
        <h2 className="text-xl font-bold text-slate-900">Status history</h2>
        {history.length ? (
          <ol className="mt-5 space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-blue-200 pl-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge label={entry.new_status} />
                  <time className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</time>
                </div>
                <p className="mt-2 text-sm text-slate-600">Updated by {entry.changed_by_name}</p>
                {entry.remark && <p className="mt-1 text-sm text-slate-700">{entry.remark}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No status updates have been recorded.</p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-slate-800">{value}</div>
    </div>
  );
}
