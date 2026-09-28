import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const initialForm = {
  categoryId: '',
  departmentId: '',
  title: '',
  description: '',
  location: '',
  priority: 'Medium',
};

export default function SubmitComplaintPage() {
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdComplaint, setCreatedComplaint] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([api.get('/complaints/categories'), api.get('/complaints/departments')])
      .then(([categoryResponse, departmentResponse]) => {
        if (!active) return;
        const availableCategories = categoryResponse.data.categories || [];
        setCategories(availableCategories);
        setDepartments(departmentResponse.data.departments || []);
        setForm((current) => ({
          ...current,
          categoryId: availableCategories.length ? String(availableCategories[0].id) : '',
        }));
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load categories and departments.');
        }
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    setCreatedComplaint(null);
    setSubmitting(true);

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '') payload.append(key, value);
    });
    files.forEach((file) => payload.append('attachments', file));

    try {
      const { data } = await api.post('/complaints', payload);
      setCreatedComplaint(data.complaint);
      setForm({
        ...initialForm,
        categoryId: categories.length ? String(categories[0].id) : '',
      });
      setFiles([]);
      formElement.reset();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit complaint. Check the connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => String(c.id) === String(form.categoryId));

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Student complaints</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Submit a complaint</h1>
        <p className="mt-2 text-slate-600">Describe the campus issue and we’ll record it for review.</p>
      </div>

      {createdComplaint && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <p className="font-semibold">Complaint submitted successfully.</p>
          <p className="mt-1 text-sm">
            Your complaint number is <strong>{createdComplaint.complaint_number}</strong>.
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold underline"
            to={`/student/complaints/${createdComplaint.id}`}
          >
            View complaint details
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-5 p-5 md:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="complaint-category">Category</label>
            <select
              id="complaint-category"
              className="input"
              name="categoryId"
              value={form.categoryId}
              onChange={updateField}
              disabled={loadingOptions || !categories.length}
              required
            >
              {!categories.length && <option value="">No categories available</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Responsible Department</label>
            <div className="input bg-slate-50 text-slate-700 flex items-center">
              {selectedCategory?.department_name ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-blue-700">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  {selectedCategory.department_name}
                </span>
              ) : (
                <span className="text-slate-500 italic">Auto-routed / Under Review</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="complaint-title">Title</label>
          <input
            id="complaint-title"
            className="input"
            name="title"
            value={form.title}
            onChange={updateField}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="complaint-description">Detailed description</label>
          <textarea
            id="complaint-description"
            className="input"
            name="description"
            rows={6}
            value={form.description}
            onChange={updateField}
            maxLength={10000}
            required
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="complaint-location">Campus location</label>
            <input
              id="complaint-location"
              className="input"
              name="location"
              value={form.location}
              onChange={updateField}
              maxLength={200}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="complaint-priority">Priority</label>
            <select
              id="complaint-priority"
              className="input"
              name="priority"
              value={form.priority}
              onChange={updateField}
            >
              {['Low', 'Medium', 'High', 'Urgent'].map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="complaint-attachments">Attachments (up to 5, max 5 MB each)</label>
          <input
            id="complaint-attachments"
            className="input"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={(event) => {
              setFiles(Array.from(event.target.files || []));
              setError('');
            }}
          />
          <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, or PDF. Executable files are not accepted.</p>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || loadingOptions || !categories.length}
        >
          {submitting ? 'Submitting…' : 'Submit complaint'}
        </button>
      </form>
    </section>
  );
}
