const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');

const statuses = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
];
const priorities = new Set(['Low', 'Medium', 'High', 'Urgent']);
const sortColumns = {
  created_at: 'c.created_at',
  updated_at: 'c.updated_at',
  complaint_number: 'c.complaint_number',
  title: 'c.title',
  status: 'c.status',
  priority: 'c.priority',
  location: 'c.location',
  category: 'cat.name',
  student_name: 'u.name',
};
const uploadDirectory = path.resolve(
  __dirname,
  '..',
  process.env.UPLOAD_DIR || 'uploads'
);

const positiveInteger = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
};

const isValidDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value));

const allowedNextStatuses = (currentStatus) => {
  const currentIndex = statuses.indexOf(currentStatus);
  return currentIndex < 0 ? [] : statuses.slice(currentIndex + 1);
};

const getDashboard = async (req, res, next) => {
  const staffId = req.user.id;

  try {
    const [counts] = await db.execute(
      `SELECT
        COUNT(*) AS total_assigned,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) AS \`submitted\`,
        SUM(CASE WHEN status = 'Under Review' THEN 1 ELSE 0 END) AS \`under_review\`,
        SUM(CASE WHEN status = 'Assigned' THEN 1 ELSE 0 END) AS \`assigned\`,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS \`in_progress\`,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS \`resolved\`,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS \`closed\`,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS \`rejected\`,
        SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) AS \`high_priority\`,
        SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) AS \`urgent_priority\`,
        SUM(CASE WHEN priority = 'Medium' THEN 1 ELSE 0 END) AS \`medium_priority\`,
        SUM(CASE WHEN priority = 'Low' THEN 1 ELSE 0 END) AS \`low_priority\`
       FROM complaints
       WHERE assigned_staff_id = ?`,
      [staffId]
    );

    const [recent] = await db.execute(
      `SELECT c.id, c.complaint_number, c.title, c.category_id, cat.name AS category_name,
         c.priority, c.status, c.location, c.created_at, c.updated_at,
         u.name AS student_name
       FROM complaints c
       INNER JOIN categories cat ON cat.id = c.category_id
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.assigned_staff_id = ?
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 5`,
      [staffId]
    );

    let department = null;
    let departmentSummary = null;
    if (req.user.department_id) {
      const [deptRows] = await db.execute(
        'SELECT id, name, description FROM departments WHERE id = ?',
        [req.user.department_id]
      );
      if (deptRows.length) {
        department = deptRows[0];
      }

      const [deptStats] = await db.execute(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status IN ('Submitted', 'Under Review', 'Assigned') THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved
         FROM complaints
         WHERE assigned_department_id = ?`,
        [req.user.department_id]
      );
      if (deptStats.length) {
        departmentSummary = {
          total: Number(deptStats[0].total || 0),
          pending: Number(deptStats[0].pending || 0),
          in_progress: Number(deptStats[0].in_progress || 0),
          resolved: Number(deptStats[0].resolved || 0),
        };
      }
    }

    const row = counts[0] || {};
    const totalAssigned = Number(row.total_assigned || 0);
    const submitted = Number(row.submitted || 0);
    const underReview = Number(row.under_review || 0);
    const assigned = Number(row.assigned || 0);
    const inProgress = Number(row.in_progress || 0);
    const resolved = Number(row.resolved || 0);
    const closed = Number(row.closed || 0);
    const rejected = Number(row.rejected || 0);
    const highPriority = Number(row.high_priority || 0);
    const urgentPriority = Number(row.urgent_priority || 0);
    const mediumPriority = Number(row.medium_priority || 0);
    const lowPriority = Number(row.low_priority || 0);

    const summary = {
      total_assigned: totalAssigned,
      submitted,
      under_review: underReview,
      assigned,
      in_progress: inProgress,
      resolved,
      closed,
      rejected,
      pending: submitted + underReview + assigned,
      high_priority: highPriority,
      urgent_priority: urgentPriority,
      medium_priority: mediumPriority,
      low_priority: lowPriority,
    };

    return res.json({
      summary,
      recent_complaints: recent,
      recentComplaints: recent,
      department,
      department_summary: departmentSummary,
    });
  } catch (error) {
    return next(error);
  }
};

const listCategories = async (_req, res, next) => {
  try {
    const [categories] = await db.execute(
      'SELECT id, name FROM categories ORDER BY name ASC'
    );
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
};

const listAssignedComplaints = async (req, res, next) => {
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const limit = req.query.limit === undefined ? 10 : positiveInteger(req.query.limit);
  const sortBy = req.query.sortBy || 'created_at';
  const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase();
  if (!page || !limit || limit > 100 || !sortColumns[sortBy] || !['asc', 'desc'].includes(sortOrder)) {
    return res.status(400).json({ message: 'Invalid pagination or sorting parameters.' });
  }

  const conditions = ['c.assigned_staff_id = ?'];
  const parameters = [req.user.id];
  if (req.query.status !== undefined && req.query.status !== '') {
    if (!statuses.includes(req.query.status)) {
      return res.status(400).json({ message: 'Invalid complaint status filter.' });
    }
    conditions.push('c.status = ?');
    parameters.push(req.query.status);
  }
  if (req.query.priority !== undefined && req.query.priority !== '') {
    if (!priorities.has(req.query.priority)) {
      return res.status(400).json({ message: 'Invalid complaint priority filter.' });
    }
    conditions.push('c.priority = ?');
    parameters.push(req.query.priority);
  }
  if (req.query.category !== undefined && req.query.category !== '') {
    const categoryId = positiveInteger(req.query.category);
    if (!categoryId) return res.status(400).json({ message: 'Invalid category filter.' });
    conditions.push('c.category_id = ?');
    parameters.push(categoryId);
  }
  if (req.query.startDate !== undefined && req.query.startDate !== '') {
    if (!isValidDate(req.query.startDate)) {
      return res.status(400).json({ message: 'startDate must be in YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at >= ?');
    parameters.push(`${req.query.startDate} 00:00:00`);
  }
  if (req.query.endDate !== undefined && req.query.endDate !== '') {
    if (!isValidDate(req.query.endDate)) {
      return res.status(400).json({ message: 'endDate must be in YYYY-MM-DD format.' });
    }
    conditions.push('c.created_at <= ?');
    parameters.push(`${req.query.endDate} 23:59:59`);
  }
  if (req.query.date !== undefined && req.query.date !== '') {
    if (!isValidDate(req.query.date)) {
      return res.status(400).json({ message: 'date must be in YYYY-MM-DD format.' });
    }
    conditions.push('DATE(c.created_at) = ?');
    parameters.push(req.query.date);
  }
  if (req.query.search !== undefined) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100) {
      return res.status(400).json({ message: 'Search must be 100 characters or fewer.' });
    }
    const term = `%${req.query.search.trim()}%`;
    conditions.push(
      '(c.complaint_number LIKE ? OR c.title LIKE ? OR c.description LIKE ? OR c.location LIKE ? OR cat.name LIKE ? OR u.name LIKE ? OR u.student_id LIKE ?)'
    );
    parameters.push(term, term, term, term, term, term, term);
  }

  const where = conditions.join(' AND ');
  try {
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM complaints c
       INNER JOIN categories cat ON cat.id = c.category_id
       INNER JOIN users u ON u.id = c.user_id
       WHERE ${where}`,
      parameters
    );
    const [complaints] = await db.execute(
      `SELECT c.id, c.complaint_number, c.title, c.description, c.location,
        c.category_id, cat.name AS category_name, c.priority, c.status,
        c.created_at, c.updated_at, c.resolved_at,
        u.name AS student_name, u.student_id
       FROM complaints c
       INNER JOIN categories cat ON cat.id = c.category_id
       INNER JOIN users u ON u.id = c.user_id
       WHERE ${where}
       ORDER BY ${sortColumns[sortBy]} ${sortOrder.toUpperCase()}, c.id DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      parameters
    );
    const total = Number(countRows[0].total);
    return res.json({
      complaints,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

const getAssignedComplaint = async (complaintId, staffId) => {
  const [rows] = await db.execute(
    `SELECT c.id, c.user_id, c.complaint_number, c.title, c.description,
      c.location, c.category_id, cat.name AS category_name,
      c.priority, c.status, c.assigned_department_id,
      d.name AS department_name, c.assigned_staff_id, s.name AS assigned_staff_name,
      c.created_at, c.updated_at, c.resolved_at,
      u.name AS student_name, u.student_id, u.phone AS student_phone
     FROM complaints c
     INNER JOIN categories cat ON cat.id = c.category_id
     INNER JOIN users u ON u.id = c.user_id
     LEFT JOIN departments d ON d.id = c.assigned_department_id
     LEFT JOIN users s ON s.id = c.assigned_staff_id
     WHERE c.id = ? AND c.assigned_staff_id = ?`,
    [complaintId, staffId]
  );
  return rows[0] || null;
};

const getComplaintDetails = async (req, res, next) => {
  const complaintId = positiveInteger(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Complaint ID must be a positive integer.' });

  try {
    const complaint = await getAssignedComplaint(complaintId, req.user.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found.' });
    const [history] = await db.execute(
      `SELECT h.id, h.previous_status, h.new_status, h.remark, h.created_at,
        u.name AS changed_by_name
       FROM complaint_status_history h
       INNER JOIN users u ON u.id = h.changed_by
       WHERE h.complaint_id = ?
       ORDER BY h.created_at ASC, h.id ASC`,
      [complaintId]
    );
    const [attachments] = await db.execute(
      `SELECT id, file_name, created_at
       FROM complaint_attachments
       WHERE complaint_id = ?
       ORDER BY created_at ASC, id ASC`,
      [complaintId]
    );

    return res.json({
      complaint,
      history,
      attachments: attachments.map(({ id, ...attachment }) => ({
        id,
        ...attachment,
        url: `/api/staff/complaints/${complaintId}/attachments/${id}`,
      })),
      allowedNextStatuses: allowedNextStatuses(complaint.status),
    });
  } catch (error) {
    return next(error);
  }
};

const updateStatus = async (req, res, next) => {
  const complaintId = positiveInteger(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Complaint ID must be a positive integer.' });
  const fields = req.body || {};
  const unexpected = Object.keys(fields).find((field) => !['status', 'remark'].includes(field));
  if (unexpected) return res.status(400).json({ message: `Field "${unexpected}" cannot be changed by staff.` });
  if (typeof fields.status !== 'string' || !statuses.includes(fields.status)) {
    return res.status(400).json({ message: 'A valid complaint status is required.' });
  }
  if (
    fields.remark !== undefined &&
    (typeof fields.remark !== 'string' || fields.remark.trim().length > 2000)
  ) {
    return res.status(400).json({ message: 'Remark must be a string of 2,000 characters or fewer.' });
  }
  const remark = typeof fields.remark === 'string' && fields.remark.trim()
    ? fields.remark.trim()
    : null;

  // Resolution remark is mandatory when closing or resolving a complaint
  if (['Resolved', 'Closed'].includes(fields.status) && !remark) {
    return res.status(400).json({
      message: 'A resolution remark is required when marking a complaint as Resolved or Closed.',
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, status FROM complaints
       WHERE id = ? AND assigned_staff_id = ?
       FOR UPDATE`,
      [complaintId, req.user.id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Complaint not found.' });
    }

    const currentStatus = rows[0].status;
    if (!allowedNextStatuses(currentStatus).includes(fields.status)) {
      await connection.rollback();
      return res.status(409).json({
        message: 'The requested status is not a valid forward transition from the current status.',
      });
    }

    await connection.execute(
      `UPDATE complaints
       SET status = ?,
         resolved_at = CASE
           WHEN ? IN ('Resolved', 'Closed') THEN COALESCE(resolved_at, NOW())
           WHEN ? NOT IN ('Resolved', 'Closed') THEN NULL
           ELSE resolved_at
         END,
         updated_at = NOW()
       WHERE id = ? AND assigned_staff_id = ?`,
      [fields.status, fields.status, fields.status, complaintId, req.user.id]
    );
    await connection.execute(
      `INSERT INTO complaint_status_history
       (complaint_id, previous_status, new_status, changed_by, remark)
       VALUES (?, ?, ?, ?, ?)`,
      [complaintId, currentStatus, fields.status, req.user.id, remark]
    );
    const [updatedRows] = await connection.execute(
      `SELECT id, complaint_number, status, priority, updated_at, resolved_at, user_id
       FROM complaints
       WHERE id = ? AND assigned_staff_id = ?`,
      [complaintId, req.user.id]
    );
    await connection.commit();

    // Send a non-fatal notification to the complaint owner after the transaction commits
    const updatedComplaint = updatedRows[0];
    if (updatedComplaint) {
      const notifTitle = `Complaint ${updatedComplaint.complaint_number} — Status Updated`;
      const notifMessage = remark
        ? `Your complaint status has been changed to "${fields.status}" by staff. Note: ${remark}`
        : `Your complaint status has been changed to "${fields.status}" by staff.`;
      await db.execute(
        `INSERT INTO notifications (user_id, complaint_id, title, message)
         VALUES (?, ?, ?, ?)`,
        [updatedComplaint.user_id, complaintId, notifTitle, notifMessage]
      ).catch((notifError) => {
        console.error('Staff status notification insert failed (non-fatal):', notifError.message);
      });
    }

    return res.json({ complaint: updatedComplaint });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Staff status transaction rollback failed:', rollbackError.message);
      }
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
};

const downloadAttachment = async (req, res, next) => {
  const complaintId = positiveInteger(req.params.id);
  const attachmentId = positiveInteger(req.params.attachmentId);
  if (!complaintId || !attachmentId) {
    return res.status(400).json({ message: 'Complaint and attachment IDs must be positive integers.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT a.file_name, a.file_path
       FROM complaint_attachments a
       INNER JOIN complaints c ON c.id = a.complaint_id
       WHERE a.id = ? AND a.complaint_id = ? AND c.assigned_staff_id = ?`,
      [attachmentId, complaintId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Attachment not found.' });

    const storedName = path.basename(rows[0].file_path);
    const resolvedPath = path.resolve(uploadDirectory, storedName);
    if (!resolvedPath.startsWith(`${uploadDirectory}${path.sep}`)) {
      return res.status(404).json({ message: 'Attachment not found.' });
    }
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'Attachment file is unavailable.' });
      }
      throw error;
    }
    return res.download(resolvedPath, rows[0].file_name);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  listCategories,
  listAssignedComplaints,
  getComplaintDetails,
  updateStatus,
  downloadAttachment,
};
