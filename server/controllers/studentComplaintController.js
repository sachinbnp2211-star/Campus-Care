const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const db = require('../config/db');

const allowedPriorities = new Set(['Low', 'Medium', 'High', 'Urgent']);
const allowedStatuses = new Set([
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
]);
const listSortColumns = {
  created_at: 'c.created_at',
  updated_at: 'c.updated_at',
  complaint_number: 'c.complaint_number',
  title: 'c.title',
  status: 'c.status',
  priority: 'c.priority',
};
const uploadDirectory = path.resolve(
  __dirname,
  '..',
  process.env.UPLOAD_DIR || 'uploads'
);

const parsePositiveInteger = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
};

const getBodyValue = (body, camelCase, snakeCase) => {
  const camelValue = body[camelCase];
  const snakeValue = body[snakeCase];
  if (camelValue !== undefined && snakeValue !== undefined) {
    return { error: `${camelCase} must be provided only once.` };
  }
  return { value: camelValue !== undefined ? camelValue : snakeValue };
};

const validateComplaintBody = (body, { allowOptionalFields = false } = {}) => {
  const acceptedFields = new Set([
    'title',
    'description',
    'location',
    'categoryId',
    'category_id',
    'departmentId',
    'department_id',
    'priority',
  ]);
  const unexpectedField = Object.keys(body).find((field) => !acceptedFields.has(field));
  if (unexpectedField) {
    return {
      error: `Field "${unexpectedField}" cannot be set by a student.`,
    };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';

  if ((!allowOptionalFields || body.title !== undefined) && !title) {
    return { error: 'Complaint title is required.' };
  }
  if ((!allowOptionalFields || body.description !== undefined) && !description) {
    return { error: 'Complaint description is required.' };
  }
  if ((!allowOptionalFields || body.location !== undefined) && !location) {
    return { error: 'Complaint location is required.' };
  }
  if (title.length > 200) return { error: 'Title must be 200 characters or fewer.' };
  if (description.length > 10000) {
    return { error: 'Description must be 10,000 characters or fewer.' };
  }
  if (location.length > 200) {
    return { error: 'Location must be 200 characters or fewer.' };
  }

  const categoryValue = getBodyValue(body, 'categoryId', 'category_id');
  if (categoryValue.error) return categoryValue;
  const categoryId =
    categoryValue.value === undefined
      ? null
      : parsePositiveInteger(categoryValue.value);
  if ((!allowOptionalFields || categoryValue.value !== undefined) && !categoryId) {
    return { error: 'A valid category is required.' };
  }

  const departmentValue = getBodyValue(body, 'departmentId', 'department_id');
  if (departmentValue.error) return departmentValue;
  const departmentId =
    departmentValue.value === undefined ||
    departmentValue.value === null ||
    departmentValue.value === ''
      ? null
      : parsePositiveInteger(departmentValue.value);
  if (departmentValue.value && !departmentId) {
    return { error: 'Department ID must be a positive integer.' };
  }

  const priority =
    body.priority === undefined || body.priority === ''
      ? 'Medium'
      : body.priority;
  if (!allowedPriorities.has(priority)) {
    return { error: 'Priority must be Low, Medium, High, or Urgent.' };
  }

  return {
    value: {
      title: body.title === undefined ? undefined : title,
      description: body.description === undefined ? undefined : description,
      location: body.location === undefined ? undefined : location,
      categoryId,
      departmentId,
      departmentSpecified: departmentValue.value !== undefined,
      priority,
    },
  };
};

const validateFileSignature = (file) => {
  const bytes = file.buffer;
  if (!bytes || !bytes.length) return null;

  if (
    file.mimetype === 'image/jpeg' &&
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return '.jpg';
  }
  if (
    file.mimetype === 'image/png' &&
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return '.png';
  }
  if (
    file.mimetype === 'image/webp' &&
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }
  if (
    file.mimetype === 'application/pdf' &&
    bytes.length >= 5 &&
    bytes.toString('ascii', 0, 5) === '%PDF-'
  ) {
    return '.pdf';
  }
  return null;
};

const safeFileName = (name) => {
  const baseName = path.basename(name || 'attachment').replace(/[\u0000-\u001f\u007f]/g, '');
  return baseName.slice(0, 255) || 'attachment';
};

const publicComplaint = (row) => ({
  id: row.id,
  complaint_number: row.complaint_number,
  title: row.title,
  description: row.description,
  location: row.location,
  category_id: row.category_id,
  category_name: row.category_name,
  priority: row.priority,
  status: row.status,
  department_id: row.assigned_department_id,
  department_name: row.department_name,
  created_at: row.created_at,
  updated_at: row.updated_at,
  resolved_at: row.resolved_at,
});

const complaintSelect = `
  SELECT c.id, c.user_id, c.complaint_number, c.title, c.description, c.location,
    c.category_id, cat.name AS category_name,
    c.priority, c.status, c.assigned_department_id,
    dept.name AS department_name, c.created_at, c.updated_at, c.resolved_at
  FROM complaints c
  INNER JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN departments dept ON dept.id = c.assigned_department_id`;

const listCategories = async (_req, res, next) => {
  try {
    const [categories] = await db.execute(
      `SELECT c.id, c.name, c.description, c.department_id, c.is_active, d.name AS department_name
       FROM categories c
       LEFT JOIN departments d ON d.id = c.department_id
       WHERE c.is_active = TRUE
       ORDER BY c.name ASC`
    );
    return res.json({ categories });
  } catch (error) {
    return next(error);
  }
};

const listDepartments = async (_req, res, next) => {
  try {
    const [departments] = await db.execute(
      'SELECT id, name, description FROM departments ORDER BY name ASC'
    );
    return res.json({ departments });
  } catch (error) {
    return next(error);
  }
};

const validateReferenceIds = async (connection, categoryId) => {
  const [categories] = await connection.execute(
    'SELECT id, is_active FROM categories WHERE id = ? LIMIT 1',
    [categoryId]
  );
  if (!categories.length) return 'Category was not found.';
  if (!categories[0].is_active) return 'The selected category is inactive.';
  return null;
};

const createComplaint = async (req, res, next) => {
  const validation = validateComplaintBody(req.body || {});
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can submit complaints.' });
  }

  const validFiles = [];
  for (const file of req.complaintFiles || []) {
    const extension = validateFileSignature(file);
    if (!extension) {
      return res.status(400).json({
        message: `Attachment "${safeFileName(file.originalname)}" does not match an allowed JPG, PNG, WebP, or PDF file.`,
      });
    }
    validFiles.push({
      buffer: file.buffer,
      extension,
      fileName: safeFileName(file.originalname),
    });
  }

  let connection;
  let lockAcquired = false;
  let lockName;
  const writtenFiles = [];

  try {
    connection = await db.getConnection();
    const year = new Date().getFullYear();
    lockName = `campus-complaint-number-${year}`;
    const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (Number(lockRows[0]?.acquired) !== 1) {
      return res.status(503).json({ message: 'Complaint numbering is busy. Please try again.' });
    }
    lockAcquired = true;

    const [categoryRows] = await connection.execute(
      'SELECT id, department_id, is_active FROM categories WHERE id = ? LIMIT 1',
      [validation.value.categoryId]
    );
    if (!categoryRows.length) {
      return res.status(400).json({ message: 'Category was not found.' });
    }
    if (!categoryRows[0].is_active) {
      return res.status(400).json({ message: 'The selected category is inactive.' });
    }
    const assignedDepartmentId = categoryRows[0].department_id || null;

    await connection.beginTransaction();

    const prefix = `CMP-${year}-`;
    const [numberRows] = await connection.execute(
      `SELECT MAX(CAST(SUBSTRING(complaint_number, ?) AS UNSIGNED)) AS last_number
       FROM complaints
       WHERE complaint_number LIKE ?`,
      [prefix.length + 1, `${prefix}%`]
    );
    const nextNumber = Number(numberRows[0]?.last_number || 0) + 1;
    const complaintNumber = `${prefix}${String(nextNumber).padStart(5, '0')}`;
    const { title, description, location, categoryId, priority } = validation.value;

    const [insertResult] = await connection.execute(
      `INSERT INTO complaints (
        complaint_number, user_id, category_id, title, description, location,
        priority, status, assigned_department_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?)`,
      [
        complaintNumber,
        req.user.id,
        categoryId,
        title,
        description,
        location,
        priority,
        assignedDepartmentId,
      ]
    );

    await connection.execute(
      `INSERT INTO complaint_status_history
        (complaint_id, previous_status, new_status, changed_by, remark)
       VALUES (?, NULL, 'Submitted', ?, ?)`,
      [insertResult.insertId, req.user.id, 'Complaint submitted by student.']
    );

    if (validFiles.length) {
      await fs.mkdir(uploadDirectory, { recursive: true });
      for (const file of validFiles) {
        const storedName = `${crypto.randomUUID()}${file.extension}`;
        await fs.writeFile(path.join(uploadDirectory, storedName), file.buffer, { flag: 'wx' });
        writtenFiles.push(storedName);
        await connection.execute(
          `INSERT INTO complaint_attachments
            (complaint_id, file_name, file_path, uploaded_by)
           VALUES (?, ?, ?, ?)`,
          [insertResult.insertId, file.fileName, storedName, req.user.id]
        );
      }
    }

    const [complaints] = await connection.execute(
      `${complaintSelect} WHERE c.id = ? AND c.user_id = ?`,
      [insertResult.insertId, req.user.id]
    );
    const [attachments] = await connection.execute(
      `SELECT id, file_name, created_at
       FROM complaint_attachments
       WHERE complaint_id = ?
       ORDER BY id ASC`,
      [insertResult.insertId]
    );
    if (!complaints.length) {
      throw new Error('Created complaint could not be loaded before committing.');
    }
    await connection.commit();
    return res.status(201).json({
      message: 'Complaint submitted successfully.',
      complaint: publicComplaint(complaints[0]),
      attachments: attachments.map((attachment) => ({
        ...attachment,
        url: `/api/complaints/${insertResult.insertId}/attachments/${attachment.id}`,
      })),
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Complaint transaction rollback failed:', rollbackError.message);
      }
    }
    await Promise.all(
      writtenFiles.map((fileName) =>
        fs.unlink(path.join(uploadDirectory, fileName)).catch((unlinkError) => {
          if (unlinkError.code !== 'ENOENT') {
            console.error('Failed to remove an uncommitted complaint attachment:', unlinkError.message);
          }
        })
      )
    );
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'The selected category or department is no longer available.' });
    }
    return next(error);
  } finally {
    if (connection && lockAcquired) {
      try {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (releaseError) {
        console.error('Failed to release complaint-number lock:', releaseError.message);
      }
    }
    if (connection) connection.release();
  }
};

const listComplaints = async (req, res, next) => {
  const {
    status,
    category,
    department,
    priority,
    search,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = req.query;
  const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page);
  const limit = req.query.limit === undefined ? 10 : parsePositiveInteger(req.query.limit);

  if (!page || !limit || limit > 100) {
    return res.status(400).json({ message: 'Page must be positive and limit must be between 1 and 100.' });
  }
  if (!listSortColumns[sortBy]) {
    return res.status(400).json({ message: 'Unsupported sort field.' });
  }
  if (!['asc', 'desc'].includes(String(sortOrder).toLowerCase())) {
    return res.status(400).json({ message: 'Sort order must be asc or desc.' });
  }
  if (status && !allowedStatuses.has(status)) {
    return res.status(400).json({ message: 'Invalid complaint status filter.' });
  }
  if (priority && !allowedPriorities.has(priority)) {
    return res.status(400).json({ message: 'Invalid priority filter.' });
  }
  if (search !== undefined && (typeof search !== 'string' || search.length > 100)) {
    return res.status(400).json({ message: 'Search must be 100 characters or fewer.' });
  }

  const categoryId = category === undefined ? null : parsePositiveInteger(category);
  const departmentId = department === undefined ? null : parsePositiveInteger(department);
  if (category !== undefined && !categoryId) {
    return res.status(400).json({ message: 'Category filter must be a positive integer.' });
  }
  if (department !== undefined && !departmentId) {
    return res.status(400).json({ message: 'Department filter must be a positive integer.' });
  }

  const where = ['c.user_id = ?'];
  const parameters = [req.user.id];
  if (status) {
    where.push('c.status = ?');
    parameters.push(status);
  }
  if (categoryId) {
    where.push('c.category_id = ?');
    parameters.push(categoryId);
  }
  if (departmentId) {
    where.push('c.assigned_department_id = ?');
    parameters.push(departmentId);
  }
  if (priority) {
    where.push('c.priority = ?');
    parameters.push(priority);
  }
  if (search?.trim()) {
    where.push('(c.complaint_number LIKE ? OR c.title LIKE ?)');
    const searchPattern = `%${search.trim()}%`;
    parameters.push(searchPattern, searchPattern);
  }
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * limit;

  try {
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM complaints c WHERE ${whereSql}`,
      parameters
    );
    const [complaints] = await db.execute(
      `${complaintSelect}
       WHERE ${whereSql}
       ORDER BY ${listSortColumns[sortBy]} ${String(sortOrder).toUpperCase()}, c.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      parameters
    );

    const total = Number(countRows[0].total);
    return res.json({
      complaints: complaints.map(publicComplaint),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getComplaintDetails = async (req, res, next) => {
  const complaintId = parsePositiveInteger(req.params.id);
  if (!complaintId) {
    return res.status(400).json({ message: 'Complaint ID must be a positive integer.' });
  }

  try {
    const [complaints] = await db.execute(
      `${complaintSelect} WHERE c.id = ?`,
      [complaintId]
    );
    if (!complaints.length) {
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    if (Number(complaints[0].user_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'You are not allowed to view this complaint.' });
    }

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
      complaint: publicComplaint(complaints[0]),
      history,
      attachments: attachments.map((attachment) => ({
        ...attachment,
        url: `/api/complaints/${complaintId}/attachments/${attachment.id}`,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const updateComplaint = async (req, res, next) => {
  const complaintId = parsePositiveInteger(req.params.id);
  if (!complaintId) {
    return res.status(400).json({ message: 'Complaint ID must be a positive integer.' });
  }

  const validation = validateComplaintBody(req.body || {}, { allowOptionalFields: true });
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }
  if (!Object.keys(req.body || {}).length) {
    return res.status(400).json({ message: 'Provide at least one editable complaint field.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [complaints] = await connection.execute(
      'SELECT id, user_id, status, category_id, assigned_department_id FROM complaints WHERE id = ? FOR UPDATE',
      [complaintId]
    );
    if (!complaints.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    const current = complaints[0];
    if (Number(current.user_id) !== Number(req.user.id)) {
      await connection.rollback();
      return res.status(403).json({ message: 'You are not allowed to modify this complaint.' });
    }
    if (current.status !== 'Submitted') {
      await connection.rollback();
      return res.status(409).json({ message: 'A complaint can only be edited while its status is Submitted.' });
    }

    const fields = validation.value;
    let newCategoryId = current.category_id;
    let newDepartmentId = current.assigned_department_id;

    if (fields.categoryId !== null && fields.categoryId !== undefined) {
      newCategoryId = fields.categoryId;
      const [categories] = await connection.execute(
        'SELECT id, department_id, is_active FROM categories WHERE id = ? LIMIT 1',
        [newCategoryId]
      );
      if (!categories.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'Category was not found.' });
      }
      if (!categories[0].is_active) {
        await connection.rollback();
        return res.status(400).json({ message: 'The selected category is inactive.' });
      }
      newDepartmentId = categories[0].department_id || null;
    }

    await connection.execute(
      `UPDATE complaints SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        location = COALESCE(?, location),
        category_id = ?,
        assigned_department_id = ?,
        priority = COALESCE(?, priority),
        updated_at = NOW()
       WHERE id = ?`,
      [
        fields.title ?? null,
        fields.description ?? null,
        fields.location ?? null,
        newCategoryId,
        newDepartmentId,
        req.body.priority === undefined ? null : fields.priority,
        complaintId,
      ]
    );

    const [updated] = await connection.execute(
      `${complaintSelect} WHERE c.id = ? AND c.user_id = ?`,
      [complaintId, req.user.id]
    );
    await connection.commit();
    return res.json({ complaint: publicComplaint(updated[0]) });
  } catch (error) {
    if (connection) await connection.rollback();
    return next(error);
  } finally {
    if (connection) connection.release();
  }
};

const denyStudentStatusUpdate = (_req, res) =>
  res.status(403).json({ message: 'Students cannot change complaint status.' });

const downloadAttachment = async (req, res, next) => {
  const complaintId = parsePositiveInteger(req.params.id);
  const attachmentId = parsePositiveInteger(req.params.attachmentId);
  if (!complaintId || !attachmentId) {
    return res.status(400).json({ message: 'Complaint and attachment IDs must be positive integers.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT a.file_name, a.file_path
       FROM complaint_attachments a
       INNER JOIN complaints c ON c.id = a.complaint_id
       WHERE a.id = ? AND a.complaint_id = ? AND c.user_id = ?`,
      [attachmentId, complaintId, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Attachment not found.' });
    }

    const storedName = path.basename(rows[0].file_path);
    const fullPath = path.join(uploadDirectory, storedName);
    const resolvedPath = path.resolve(fullPath);
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
  listCategories,
  listDepartments,
  createComplaint,
  listComplaints,
  getComplaintDetails,
  updateComplaint,
  denyStudentStatusUpdate,
  downloadAttachment,
};
