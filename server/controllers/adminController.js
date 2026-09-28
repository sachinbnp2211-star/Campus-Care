const bcrypt = require('bcryptjs');
const db = require('../config/db');

const statuses = new Set([
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
]);
const priorities = new Set(['Low', 'Medium', 'High', 'Urgent']);
const roles = new Set(['student', 'staff', 'admin']);
const sortColumns = {
  created_at: 'c.created_at',
  updated_at: 'c.updated_at',
  complaint_number: 'c.complaint_number',
  title: 'c.title',
  status: 'c.status',
  priority: 'c.priority',
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const positiveInteger = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
};

const optionalId = (value) => {
  if (value === null || value === '') return { value: null };
  const id = positiveInteger(value);
  return id ? { value: id } : { error: 'IDs must be positive integers or null.' };
};

const referenceText = (body) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = body.description === undefined ? '' : body.description;
  if (!name || name.length > 100) return { error: 'Name is required and must be 100 characters or fewer.' };
  if (typeof description !== 'string' || description.length > 2000) {
    return { error: 'Description must be a string of 2,000 characters or fewer.' };
  }
  return { value: { name, description: description.trim() } };
};

const sendDatabaseError = (res, error, message) => {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'A record with that name already exists.' });
  }
  console.error(message, error);
  return res.status(500).json({ message: 'Unable to complete the administration request.' });
};

const getDashboard = async (_req, res) => {
  try {
    const [stats] = await db.execute(
      `SELECT
        (SELECT COUNT(*) FROM complaints) AS total_complaints,
        (SELECT COUNT(*) FROM complaints WHERE status IN ('Submitted','Under Review','Assigned')) AS pending,
        (SELECT COUNT(*) FROM complaints WHERE status = 'In Progress') AS in_progress,
        (SELECT COUNT(*) FROM complaints WHERE status IN ('Resolved','Closed')) AS resolved,
        (SELECT COUNT(*) FROM complaints WHERE status = 'Rejected') AS rejected,
        (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'staff') AS total_staff`
    );
    const [categoryStats] = await db.execute(
      `SELECT c.name AS category, COUNT(cp.id) AS value
       FROM categories c LEFT JOIN complaints cp ON cp.category_id = c.id
       GROUP BY c.id, c.name ORDER BY value DESC`
    );
    const [statusStats] = await db.execute(
      'SELECT status AS name, COUNT(*) AS value FROM complaints GROUP BY status'
    );
    const [recentComplaints] = await db.execute(
      `SELECT c.id, c.complaint_number, c.title, c.status, c.priority, c.created_at,
        u.name AS student_name
       FROM complaints c INNER JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC LIMIT 6`
    );
    const [monthlyStats] = await db.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM complaints GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC LIMIT 12`
    );

    res.json({
      stats: stats[0],
      categoryStats,
      statusStats,
      recentComplaints,
      monthlyStats: monthlyStats.reverse(),
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Unable to load admin dashboard data.' });
  }
};

const listComplaints = async (req, res) => {
  const page = req.query.page === undefined ? 1 : positiveInteger(req.query.page);
  const limit = req.query.limit === undefined ? 10 : positiveInteger(req.query.limit);
  const sortBy = req.query.sortBy || 'created_at';
  const sortOrder = (req.query.sortOrder || 'desc').toLowerCase();
  if (!page || !limit || limit > 100 || !sortColumns[sortBy] || !['asc', 'desc'].includes(sortOrder)) {
    return res.status(400).json({ message: 'Invalid pagination or sorting parameters.' });
  }

  const conditions = [];
  const parameters = [];
  const { status, priority, category, department, search } = req.query;
  if (status) {
    if (!statuses.has(status)) return res.status(400).json({ message: 'Invalid complaint status.' });
    conditions.push('c.status = ?');
    parameters.push(status);
  }
  if (priority) {
    if (!priorities.has(priority)) return res.status(400).json({ message: 'Invalid complaint priority.' });
    conditions.push('c.priority = ?');
    parameters.push(priority);
  }
  for (const [filter, column] of [['category', 'c.category_id'], ['department', 'c.assigned_department_id']]) {
    if (req.query[filter] !== undefined && req.query[filter] !== '') {
      const id = positiveInteger(req.query[filter]);
      if (!id) return res.status(400).json({ message: `Invalid ${filter} filter.` });
      conditions.push(`${column} = ?`);
      parameters.push(id);
    }
  }
  if (search !== undefined) {
    if (typeof search !== 'string' || search.length > 100) {
      return res.status(400).json({ message: 'Search must be 100 characters or fewer.' });
    }
    const term = `%${search.trim()}%`;
    conditions.push('(c.complaint_number LIKE ? OR c.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    parameters.push(term, term, term, term);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM complaints c INNER JOIN users u ON u.id = c.user_id ${where}`,
      parameters
    );
    const offset = (page - 1) * limit;
    const [complaints] = await db.execute(
      `SELECT c.id, c.user_id, c.complaint_number, c.title, c.description, c.location,
        c.category_id, cat.name AS category_name, c.priority, c.status,
        c.assigned_department_id, d.name AS department_name,
        c.assigned_staff_id, s.name AS staff_name, u.name AS student_name,
        u.email AS student_email, c.created_at, c.updated_at, c.resolved_at
       FROM complaints c
       INNER JOIN users u ON u.id = c.user_id
       INNER JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN departments d ON d.id = c.assigned_department_id
       LEFT JOIN users s ON s.id = c.assigned_staff_id AND s.role = 'staff'
       ${where}
       ORDER BY ${sortColumns[sortBy]} ${sortOrder.toUpperCase()}, c.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      parameters
    );
    const total = Number(countRows[0].total);
    res.json({
      complaints,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Admin complaint list error:', error);
    res.status(500).json({ message: 'Unable to load complaints.' });
  }
};

const updateComplaint = async (req, res) => {
  const complaintId = positiveInteger(req.params.id);
  if (!complaintId) return res.status(400).json({ message: 'Invalid complaint ID.' });
  const allowedFields = new Set(['status', 'priority', 'departmentId', 'staffId', 'remark']);
  const unexpected = Object.keys(req.body).find((field) => !allowedFields.has(field));
  if (unexpected) return res.status(400).json({ message: `Field "${unexpected}" cannot be changed here.` });
  if (!Object.keys(req.body).length) return res.status(400).json({ message: 'At least one field is required.' });
  if (req.body.status !== undefined && !statuses.has(req.body.status)) {
    return res.status(400).json({ message: 'Invalid complaint status.' });
  }
  if (req.body.priority !== undefined && !priorities.has(req.body.priority)) {
    return res.status(400).json({ message: 'Invalid complaint priority.' });
  }
  if (req.body.remark !== undefined && (typeof req.body.remark !== 'string' || req.body.remark.trim().length > 2000)) {
    return res.status(400).json({ message: 'Remark must be a string of 2,000 characters or fewer.' });
  }
  const department = req.body.departmentId === undefined ? undefined : optionalId(req.body.departmentId);
  const staff = req.body.staffId === undefined ? undefined : optionalId(req.body.staffId);
  if (department?.error || staff?.error) return res.status(400).json({ message: 'Department and staff IDs must be positive integers or null.' });
  if (department?.value === null && staff?.value) {
    return res.status(400).json({ message: 'A department is required when assigning a staff member.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, status, priority, assigned_department_id, assigned_staff_id FROM complaints WHERE id = ? FOR UPDATE',
      [complaintId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Complaint not found.' });
    }
    const current = rows[0];
    let departmentId = department ? department.value : current.assigned_department_id;
    let staffId = staff ? staff.value : current.assigned_staff_id;
    if (
      department &&
      departmentId !== current.assigned_department_id &&
      staff === undefined
    ) {
      staffId = null;
    }

    if (department && departmentId !== null) {
      const [departmentRows] = await connection.execute('SELECT id FROM departments WHERE id = ?', [departmentId]);
      if (!departmentRows.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected department does not exist.' });
      }
    }
    if (staff && staffId !== null) {
      const [staffRows] = await connection.execute(
        "SELECT id, department_id, status FROM users WHERE id = ? AND role = 'staff'",
        [staffId]
      );
      if (!staffRows.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected user is not a staff member.' });
      }
      if (staffRows[0].status !== 'Active') {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected staff member is inactive and cannot be assigned.' });
      }
      if (Number(staffRows[0].department_id) !== Number(departmentId)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected staff member must belong to the assigned department.' });
      }
    }

    const assignmentChanged =
      Number(departmentId) !== Number(current.assigned_department_id) ||
      Number(staffId) !== Number(current.assigned_staff_id);
    let status = req.body.status === undefined ? current.status : req.body.status;
    if (
      req.body.status === undefined &&
      assignmentChanged &&
      departmentId !== null &&
      ['Submitted', 'Under Review'].includes(current.status)
    ) {
      status = 'Assigned';
    }
    const priority = req.body.priority === undefined ? current.priority : req.body.priority;
    const values = [status, priority, departmentId, staffId];
    await connection.execute(
      `UPDATE complaints
       SET status = ?, priority = ?, assigned_department_id = ?, assigned_staff_id = ?,
         resolved_at = CASE
           WHEN ? IN ('Resolved', 'Closed') THEN COALESCE(resolved_at, NOW())
           WHEN ? NOT IN ('Resolved', 'Closed') THEN NULL
           ELSE resolved_at
         END,
         updated_at = NOW()
       WHERE id = ?`,
      [...values, status, status, complaintId]
    );
    if (status !== current.status) {
      const remark = req.body.remark?.trim() ||
        (assignmentChanged ? 'Complaint assigned by administrator.' : 'Status updated by administrator.');
      await connection.execute(
        `INSERT INTO complaint_status_history
         (complaint_id, previous_status, new_status, changed_by, remark)
         VALUES (?, ?, ?, ?, ?)`,
        [complaintId, current.status, status, req.user.id, remark]
      );
    }
    const [updatedRows] = await connection.execute(
      `SELECT c.id, c.user_id, c.complaint_number, c.title, c.category_id,
        cat.name AS category_name, c.priority, c.status,
        c.assigned_department_id, d.name AS department_name,
        c.assigned_staff_id, s.name AS staff_name, c.updated_at, c.resolved_at
       FROM complaints c
       INNER JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN departments d ON d.id = c.assigned_department_id
       LEFT JOIN users s ON s.id = c.assigned_staff_id
       WHERE c.id = ?`,
      [complaintId]
    );

    if (staffId && Number(staffId) !== Number(current.assigned_staff_id)) {
      const assignedComplaint = updatedRows[0];
      await connection.execute(
        `INSERT INTO notifications (user_id, complaint_id, title, message)
         VALUES (?, ?, ?, ?)`,
        [
          staffId,
          complaintId,
          `New complaint assigned: ${assignedComplaint.complaint_number}`,
          `Complaint ${assignedComplaint.complaint_number} (${assignedComplaint.category_name}, Priority: ${assignedComplaint.priority}) has been assigned to you.`,
        ]
      ).catch((notifError) => {
        console.error('Failed to create staff assignment notification:', notifError.message);
      });
    }

    await connection.commit();
    res.json({ complaint: updatedRows[0] });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Admin complaint update error:', error);
    res.status(500).json({ message: 'Unable to update complaint.' });
  } finally {
    connection?.release();
  }
};

const listUsers = async (_req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.student_id, u.role,
        u.department_id, d.name AS department_name, u.status, u.created_at
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       ORDER BY u.created_at DESC`
    );
    res.json({ users });
  } catch (error) {
    console.error('Admin user list error:', error);
    res.status(500).json({ message: 'Unable to load users.' });
  }
};

const updateUser = async (req, res) => {
  const allowedFields = new Set(['role', 'departmentId', 'status']);
  const unexpected = Object.keys(req.body).find((field) => !allowedFields.has(field));
  if (unexpected) return res.status(400).json({ message: `Field "${unexpected}" cannot be changed here.` });
  if (!Object.keys(req.body).length) return res.status(400).json({ message: 'At least one field is required.' });
  const id = positiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid user ID.' });
  if (id === req.user.id && req.body.role !== undefined && req.body.role !== 'admin') {
    return res.status(400).json({ message: 'You cannot change your own administrator role.' });
  }
  if (req.body.role !== undefined && !roles.has(req.body.role)) {
    return res.status(400).json({ message: 'Role must be student, staff, or admin.' });
  }
  if (req.body.status !== undefined && !['Active', 'Inactive'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Status must be Active or Inactive.' });
  }
  const department = req.body.departmentId === undefined ? undefined : optionalId(req.body.departmentId);
  if (department?.error) return res.status(400).json({ message: 'Department ID must be a positive integer or null.' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      'SELECT id, role, department_id, status FROM users WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'User not found.' });
    }
    const current = rows[0];
    const role = req.body.role === undefined ? current.role : req.body.role;
    const departmentId = department === undefined ? current.department_id : department.value;
    const status = req.body.status === undefined ? current.status : req.body.status;

    if (current.role === 'admin' && role !== 'admin') {
      const [admins] = await connection.execute("SELECT id FROM users WHERE role = 'admin' FOR UPDATE");
      if (admins.length <= 1) {
        await connection.rollback();
        return res.status(409).json({ message: 'At least one administrator account must remain.' });
      }
    }
    if (departmentId !== null) {
      const [departments] = await connection.execute('SELECT id FROM departments WHERE id = ?', [departmentId]);
      if (!departments.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'Selected department does not exist.' });
      }
    }
    await connection.execute(
      'UPDATE users SET role = ?, department_id = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [role, departmentId, status, id]
    );
    const [updatedUsers] = await connection.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.student_id, u.role,
        u.department_id, d.name AS department_name, u.status, u.created_at
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [id]
    );
    await connection.commit();
    res.json({ user: updatedUsers[0] });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Admin user update error:', error);
    res.status(500).json({ message: 'Unable to update user.' });
  } finally {
    connection?.release();
  }
};

const listStaff = async (req, res) => {
  try {
    const conditions = ["u.role = 'staff'"];
    const parameters = [];
    const { departmentId, department, status, search } = req.query;

    const deptFilter = departmentId || department;
    if (deptFilter !== undefined && deptFilter !== '') {
      const id = positiveInteger(deptFilter);
      if (!id) return res.status(400).json({ message: 'Invalid department filter.' });
      conditions.push('u.department_id = ?');
      parameters.push(id);
    }

    if (status) {
      if (!['Active', 'Inactive'].includes(status)) {
        return res.status(400).json({ message: 'Status must be Active or Inactive.' });
      }
      conditions.push('u.status = ?');
      parameters.push(status);
    }

    if (search !== undefined && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      parameters.push(term, term, term);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [staff] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.department_id,
        d.name AS department_name, u.status, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       ${where}
       ORDER BY u.created_at DESC`,
      parameters
    );

    res.json({ staff });
  } catch (error) {
    console.error('Admin staff list error:', error);
    res.status(500).json({ message: 'Unable to load staff members.' });
  }
};

const createStaff = async (req, res) => {
  const { name, email, password, phone, departmentId, status } = req.body || {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const normalizedEmail = normalizeEmail(email);
  const passwordStr = typeof password === 'string' ? password : '';
  const phoneStr = typeof phone === 'string' ? phone.trim() : null;

  if (!trimmedName || !normalizedEmail || !passwordStr) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }
  if (trimmedName.length > 100) {
    return res.status(400).json({ message: 'Name must be 100 characters or fewer.' });
  }
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (passwordStr.length < 8 || passwordStr.length > 72) {
    return res.status(400).json({ message: 'Password must be between 8 and 72 characters.' });
  }
  if (phoneStr && phoneStr.length > 30) {
    return res.status(400).json({ message: 'Phone must be 30 characters or fewer.' });
  }

  const staffStatus = status ? status : 'Active';
  if (!['Active', 'Inactive'].includes(staffStatus)) {
    return res.status(400).json({ message: 'Status must be Active or Inactive.' });
  }

  let deptId = null;
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    deptId = positiveInteger(departmentId);
    if (!deptId) {
      return res.status(400).json({ message: 'Department ID must be a positive integer.' });
    }
    const [deptRows] = await db.execute('SELECT id FROM departments WHERE id = ?', [deptId]);
    if (!deptRows.length) {
      return res.status(400).json({ message: 'Selected department does not exist.' });
    }
  }

  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(passwordStr, 12);
    // Explicitly enforce role = 'staff'
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, phone, role, department_id, status)
       VALUES (?, ?, ?, ?, 'staff', ?, ?)`,
      [trimmedName, normalizedEmail, passwordHash, phoneStr || null, deptId, staffStatus]
    );

    const [createdRows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.department_id,
        d.name AS department_name, u.status, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      staff: createdRows[0],
      message: 'Staff account created successfully.',
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email is already registered.' });
    }
    console.error('Admin create staff error:', error);
    return res.status(500).json({ message: 'Unable to create staff account.' });
  }
};

const updateStaff = async (req, res) => {
  const id = positiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid staff ID.' });

  const allowedFields = new Set(['name', 'email', 'phone', 'departmentId', 'status']);
  const unexpected = Object.keys(req.body).find((field) => !allowedFields.has(field));
  if (unexpected) return res.status(400).json({ message: `Field "${unexpected}" cannot be changed here.` });
  if (!Object.keys(req.body).length) return res.status(400).json({ message: 'At least one field is required.' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT id, name, email, phone, role, department_id, status FROM users WHERE id = ? AND role = 'staff' FOR UPDATE",
      [id]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Staff member not found.' });
    }
    const current = rows[0];

    let newName = current.name;
    if (req.body.name !== undefined) {
      newName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!newName || newName.length > 100) {
        await connection.rollback();
        return res.status(400).json({ message: 'Name is required and must be 100 characters or fewer.' });
      }
    }

    let newEmail = current.email;
    if (req.body.email !== undefined) {
      newEmail = normalizeEmail(req.body.email);
      if (!isValidEmail(newEmail)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
      if (newEmail !== current.email) {
        const [emailExists] = await connection.execute(
          'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
          [newEmail, id]
        );
        if (emailExists.length) {
          await connection.rollback();
          return res.status(409).json({ message: 'Email is already in use by another account.' });
        }
      }
    }

    let newPhone = current.phone;
    if (req.body.phone !== undefined) {
      if (req.body.phone === null || req.body.phone === '') {
        newPhone = null;
      } else if (typeof req.body.phone === 'string') {
        newPhone = req.body.phone.trim();
        if (newPhone.length > 30) {
          await connection.rollback();
          return res.status(400).json({ message: 'Phone must be 30 characters or fewer.' });
        }
      } else {
        await connection.rollback();
        return res.status(400).json({ message: 'Phone must be a string or null.' });
      }
    }

    let newDepartmentId = current.department_id;
    if (req.body.departmentId !== undefined) {
      const dept = optionalId(req.body.departmentId);
      if (dept.error) {
        await connection.rollback();
        return res.status(400).json({ message: 'Department ID must be a positive integer or null.' });
      }
      newDepartmentId = dept.value;
      if (newDepartmentId !== null) {
        const [departments] = await connection.execute('SELECT id FROM departments WHERE id = ?', [newDepartmentId]);
        if (!departments.length) {
          await connection.rollback();
          return res.status(400).json({ message: 'Selected department does not exist.' });
        }
      }
    }

    let newStatus = current.status;
    if (req.body.status !== undefined) {
      if (!['Active', 'Inactive'].includes(req.body.status)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Status must be Active or Inactive.' });
      }
      newStatus = req.body.status;
    }

    await connection.execute(
      `UPDATE users
       SET name = ?, email = ?, phone = ?, department_id = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND role = 'staff'`,
      [newName, newEmail, newPhone, newDepartmentId, newStatus, id]
    );

    const [updatedStaff] = await connection.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.department_id,
        d.name AS department_name, u.status, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [id]
    );

    await connection.commit();
    return res.json({
      staff: updatedStaff[0],
      message: 'Staff account updated successfully.',
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Admin staff update error:', error);
    return res.status(500).json({ message: 'Unable to update staff account.' });
  } finally {
    connection?.release();
  }
};

const updateStaffStatus = async (req, res) => {
  const id = positiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid staff ID.' });

  const { status } = req.body || {};
  if (!status || !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Active or Inactive.' });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id FROM users WHERE id = ? AND role = 'staff'",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    await db.execute(
      "UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND role = 'staff'",
      [status, id]
    );

    const [updatedStaff] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.department_id,
        d.name AS department_name, u.status, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`,
      [id]
    );

    return res.json({
      staff: updatedStaff[0],
      message: `Staff account status changed to ${status}.`,
    });
  } catch (error) {
    console.error('Admin staff status update error:', error);
    return res.status(500).json({ message: 'Unable to update staff status.' });
  }
};

const resetStaffPassword = async (req, res) => {
  const id = positiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid staff ID.' });

  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!password || password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Password must be between 8 and 72 characters.' });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id FROM users WHERE id = ? AND role = 'staff'",
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.execute(
      "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ? AND role = 'staff'",
      [passwordHash, id]
    );

    return res.json({ message: 'Staff password has been reset successfully.' });
  } catch (error) {
    console.error('Admin reset staff password error:', error);
    return res.status(500).json({ message: 'Unable to reset staff password.' });
  }
};

const listCategories = async (_req, res) => {
  try {
    const [categories] = await db.execute(
      `SELECT c.id, c.name, c.description, c.department_id, c.is_active, d.name AS department_name
       FROM categories c
       LEFT JOIN departments d ON d.id = c.department_id
       ORDER BY c.name ASC`
    );
    res.json({ categories });
  } catch (error) {
    console.error('Admin category list error:', error);
    res.status(500).json({ message: 'Unable to load categories.' });
  }
};

const saveCategory = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description =
    typeof req.body.description === 'string'
      ? req.body.description.trim()
      : (req.body.description === null ? null : undefined);

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }
  if (name.length > 100) {
    return res.status(400).json({ message: 'Category name must be 100 characters or fewer.' });
  }
  if (description !== undefined && description !== null && description.length > 2000) {
    return res.status(400).json({ message: 'Category description must be 2,000 characters or fewer.' });
  }

  const rawDept =
    req.body.departmentId !== undefined
      ? req.body.departmentId
      : req.body.department_id;
  let departmentId = null;
  if (rawDept !== undefined && rawDept !== null && rawDept !== '') {
    departmentId = positiveInteger(rawDept);
    if (!departmentId) {
      return res.status(400).json({ message: 'Department ID must be a positive integer or null.' });
    }
    const [deptRows] = await db.execute('SELECT id, name FROM departments WHERE id = ?', [departmentId]);
    if (!deptRows.length) {
      return res.status(400).json({ message: 'Selected department does not exist.' });
    }
  }

  const rawActive =
    req.body.isActive !== undefined
      ? req.body.isActive
      : req.body.is_active;
  let isActive = true;
  if (rawActive !== undefined) {
    if (typeof rawActive === 'boolean') {
      isActive = rawActive;
    } else if (rawActive === 'true' || rawActive === 1 || rawActive === '1') {
      isActive = true;
    } else if (rawActive === 'false' || rawActive === 0 || rawActive === '0') {
      isActive = false;
    } else {
      return res.status(400).json({ message: 'isActive must be a boolean.' });
    }
  }

  try {
    if (req.method === 'POST') {
      const [result] = await db.execute(
        'INSERT INTO categories (name, description, department_id, is_active) VALUES (?, ?, ?, ?)',
        [name, description || null, departmentId, isActive ? 1 : 0]
      );
      const [created] = await db.execute(
        `SELECT c.id, c.name, c.description, c.department_id, c.is_active, d.name AS department_name
         FROM categories c LEFT JOIN departments d ON d.id = c.department_id
         WHERE c.id = ?`,
        [result.insertId]
      );
      return res.status(201).json({ category: created[0] });
    }

    const id = positiveInteger(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid category ID.' });

    const [existingRows] = await db.execute('SELECT id FROM categories WHERE id = ?', [id]);
    if (!existingRows.length) return res.status(404).json({ message: 'Category not found.' });

    await db.execute(
      'UPDATE categories SET name = ?, description = ?, department_id = ?, is_active = ? WHERE id = ?',
      [name, description || null, departmentId, isActive ? 1 : 0, id]
    );

    const [updated] = await db.execute(
      `SELECT c.id, c.name, c.description, c.department_id, c.is_active, d.name AS department_name
       FROM categories c LEFT JOIN departments d ON d.id = c.department_id
       WHERE c.id = ?`,
      [id]
    );
    return res.json({ category: updated[0] });
  } catch (error) {
    return sendDatabaseError(res, error, 'Admin category save error:');
  }
};

const saveReference = (table, label) => async (req, res) => {
  const validated = referenceText(req.body);
  if (validated.error) return res.status(400).json({ message: validated.error });
  try {
    if (req.method === 'POST') {
      const [result] = await db.execute(
        `INSERT INTO ${table} (name, description) VALUES (?, ?)`,
        [validated.value.name, validated.value.description || null]
      );
      return res.status(201).json({ [label]: { id: result.insertId, ...validated.value } });
    }
    const id = positiveInteger(req.params.id);
    if (!id) return res.status(400).json({ message: `Invalid ${label} ID.` });
    const [existingRows] = await db.execute(`SELECT id FROM ${table} WHERE id = ?`, [id]);
    if (!existingRows.length) return res.status(404).json({ message: `${label} not found.` });
    const [result] = await db.execute(
      `UPDATE ${table} SET name = ?, description = ? WHERE id = ?`,
      [validated.value.name, validated.value.description || null, id]
    );
    return res.json({ [label]: { id, ...validated.value } });
  } catch (error) {
    return sendDatabaseError(res, error, `Admin ${label} save error:`);
  }
};

const listDepartments = async (_req, res) => {
  try {
    const [departments] = await db.execute('SELECT id, name, description FROM departments ORDER BY name ASC');
    res.json({ departments });
  } catch (error) {
    console.error('Admin department list error:', error);
    res.status(500).json({ message: 'Unable to load departments.' });
  }
};

module.exports = {
  getDashboard,
  listComplaints,
  updateComplaint,
  listUsers,
  updateUser,
  listStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
  resetStaffPassword,
  listCategories,
  saveCategory,
  listDepartments,
  saveDepartment: saveReference('departments', 'department'),
};
