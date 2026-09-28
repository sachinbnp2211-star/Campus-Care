const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');
const app = require('../app');
const db = require('../config/db');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-six-integration-test-secret-0123456789';

const server = app.listen(0, '127.0.0.1');
const userIds = [];
const complaintIds = [];
const attachmentIds = [];
let baseUrl;
let categoryId;
let departmentId;
let staff;
let otherStaff;
let student;
let admin;
let assignedComplaintId;
let otherStaffComplaintId;
let departmentOnlyComplaintId;
let attachmentId;
let attachmentFilePath;

const request = async (pathname, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers, body: payload });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, data };
};

const createAccount = async ({ email, role, name, departmentId: accountDepartment = null }) => {
  const password = 'phase-six-test-password';
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, role, department_id)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, role, accountDepartment]
  );
  userIds.push(result.insertId);
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  return { id: result.insertId, token: login.data.token };
};

const createComplaint = async ({ complaintNumber, title, assignedStaffId }) => {
  const [result] = await db.execute(
    `INSERT INTO complaints
     (complaint_number, user_id, category_id, title, description, location,
      priority, status, assigned_department_id, assigned_staff_id)
     VALUES (?, ?, ?, ?, ?, ?, 'Medium', 'Assigned', ?, ?)`,
    [
      complaintNumber,
      student.id,
      categoryId,
      title,
      'Staff integration test complaint description.',
      'North campus',
      departmentId,
      assignedStaffId,
    ]
  );
  complaintIds.push(result.insertId);
  await db.execute(
    `INSERT INTO complaint_status_history
     (complaint_id, previous_status, new_status, changed_by, remark)
     VALUES (?, 'Under Review', 'Assigned', ?, 'Assigned for staff test.')`,
    [result.insertId, admin.id]
  );
  return result.insertId;
};

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [departmentResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [`Staff Test Department ${suffix}`, 'Temporary staff API fixture']
  );
  departmentId = departmentResult.insertId;
  const [categoryResult] = await db.execute(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [`Staff Test Category ${suffix}`, 'Temporary staff API fixture']
  );
  categoryId = categoryResult.insertId;

  admin = await createAccount({
    email: `phase6-admin-${suffix}@example.test`,
    role: 'admin',
    name: 'Phase 6 Test Admin',
  });
  student = await createAccount({
    email: `phase6-student-${suffix}@example.test`,
    role: 'student',
    name: 'Phase 6 Test Student',
  });
  staff = await createAccount({
    email: `phase6-staff-${suffix}@example.test`,
    role: 'staff',
    name: 'Phase 6 Assigned Staff',
    departmentId,
  });
  otherStaff = await createAccount({
    email: `phase6-other-staff-${suffix}@example.test`,
    role: 'staff',
    name: 'Phase 6 Other Staff',
    departmentId,
  });

  assignedComplaintId = await createComplaint({
    complaintNumber: `STAFFTEST-${suffix}-1`,
    title: 'Directly assigned complaint',
    assignedStaffId: staff.id,
  });
  otherStaffComplaintId = await createComplaint({
    complaintNumber: `STAFFTEST-${suffix}-2`,
    title: 'Other staff complaint',
    assignedStaffId: otherStaff.id,
  });
  departmentOnlyComplaintId = await createComplaint({
    complaintNumber: `STAFFTEST-${suffix}-3`,
    title: 'Department only complaint',
    assignedStaffId: null,
  });

  const filename = `staff-test-${suffix}.txt`;
  attachmentFilePath = path.join(__dirname, '..', 'uploads', filename);
  await fs.writeFile(attachmentFilePath, 'private attachment test content', { flag: 'wx' });
  const [attachmentResult] = await db.execute(
    `INSERT INTO complaint_attachments (complaint_id, file_name, file_path, uploaded_by)
     VALUES (?, ?, ?, ?)`,
    [assignedComplaintId, 'staff-evidence.txt', filename, student.id]
  );
  attachmentId = attachmentResult.insertId;
  attachmentIds.push(attachmentId);
});

after(async () => {
  if (attachmentFilePath) await fs.unlink(attachmentFilePath).catch(() => {});
  for (const complaintId of complaintIds) {
    await db.execute('DELETE FROM complaints WHERE id = ?', [complaintId]);
  }
  for (const userId of userIds) {
    await db.execute('DELETE FROM users WHERE id = ?', [userId]);
  }
  if (categoryId) await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
  if (departmentId) await db.execute('DELETE FROM departments WHERE id = ?', [departmentId]);
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('staff-only complaint APIs enforce assignment and maintain status history', async (t) => {
  await t.test('requires authentication and denies student and administrator roles', async () => {
    const anonymous = await request('/api/staff/complaints');
    assert.equal(anonymous.response.status, 401);
    const studentDenied = await request('/api/staff/complaints', { token: student.token });
    assert.equal(studentDenied.response.status, 403);
    const adminDenied = await request('/api/staff/complaints', { token: admin.token });
    assert.equal(adminDenied.response.status, 403);
  });

  await t.test('lists only directly assigned complaints with filtering and pagination', async () => {
    const list = await request('/api/staff/complaints?search=Directly%20assigned&page=1&limit=1', {
      token: staff.token,
    });
    assert.equal(list.response.status, 200, JSON.stringify(list.data));
    assert.equal(list.data.complaints.length, 1);
    assert.equal(list.data.complaints[0].id, assignedComplaintId);
    assert.equal(list.data.pagination.total, 1);
    assert.equal(list.data.pagination.limit, 1);

    const all = await request('/api/staff/complaints', { token: staff.token });
    const returnedIds = all.data.complaints.map((complaint) => complaint.id);
    assert.ok(returnedIds.includes(assignedComplaintId));
    assert.ok(!returnedIds.includes(otherStaffComplaintId));
    assert.ok(!returnedIds.includes(departmentOnlyComplaintId));

    const invalidSort = await request('/api/staff/complaints?sortBy=title;DROP%20TABLE%20users', {
      token: staff.token,
    });
    assert.equal(invalidSort.response.status, 400);
    const invalidStatus = await request('/api/staff/complaints?status=Imaginary', { token: staff.token });
    assert.equal(invalidStatus.response.status, 400);
  });

  await t.test('returns assigned details, history, attachment link, and allowed next statuses', async () => {
    const result = await request(`/api/staff/complaints/${assignedComplaintId}`, { token: staff.token });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.complaint.complaint_number.startsWith('STAFFTEST-'), true);
    assert.equal(result.data.complaint.student_name, 'Phase 6 Test Student');
    assert.equal(Object.hasOwn(result.data.complaint, 'student_email'), false);
    assert.equal(result.data.history.length, 1);
    assert.equal(result.data.attachments[0].file_name, 'staff-evidence.txt');
    assert.equal(result.data.attachments[0].url, `/api/staff/complaints/${assignedComplaintId}/attachments/${attachmentId}`);
    assert.ok(!JSON.stringify(result.data.attachments).includes('file_path'));
    assert.deepEqual(result.data.allowedNextStatuses, ['In Progress', 'Resolved', 'Closed', 'Rejected']);

    const invalidId = await request('/api/staff/complaints/not-an-id', { token: staff.token });
    assert.equal(invalidId.response.status, 400);
    const otherStaffDenied = await request(`/api/staff/complaints/${otherStaffComplaintId}`, { token: staff.token });
    assert.equal(otherStaffDenied.response.status, 404);
    const departmentOnlyDenied = await request(`/api/staff/complaints/${departmentOnlyComplaintId}`, { token: staff.token });
    assert.equal(departmentOnlyDenied.response.status, 404);
  });

  await t.test('downloads only attachments belonging to directly assigned complaints', async () => {
    const ownAttachment = await request(
      `/api/staff/complaints/${assignedComplaintId}/attachments/${attachmentId}`,
      { token: staff.token }
    );
    assert.equal(ownAttachment.response.status, 200);
    assert.equal(ownAttachment.data.toString(), 'private attachment test content');

    const wrongComplaint = await request(
      `/api/staff/complaints/${otherStaffComplaintId}/attachments/${attachmentId}`,
      { token: staff.token }
    );
    assert.equal(wrongComplaint.response.status, 404);
    const studentCannotUseStaffDownload = await request(
      `/api/staff/complaints/${assignedComplaintId}/attachments/${attachmentId}`,
      { token: student.token }
    );
    assert.equal(studentCannotUseStaffDownload.response.status, 403);
  });

  await t.test('updates status and atomically records actor, transition, and remark', async () => {
    const changed = await request(`/api/staff/complaints/${assignedComplaintId}/status`, {
      method: 'PATCH',
      token: staff.token,
      body: { status: 'In Progress', remark: 'Inspection started.' },
    });
    assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
    assert.equal(changed.data.complaint.status, 'In Progress');

    const [history] = await db.execute(
      `SELECT previous_status, new_status, changed_by, remark
       FROM complaint_status_history
       WHERE complaint_id = ? ORDER BY id`,
      [assignedComplaintId]
    );
    assert.equal(history.length, 2);
    assert.equal(history[1].previous_status, 'Assigned');
    assert.equal(history[1].new_status, 'In Progress');
    assert.equal(history[1].changed_by, staff.id);
    assert.equal(history[1].remark, 'Inspection started.');

    const details = await request(`/api/staff/complaints/${assignedComplaintId}`, { token: staff.token });
    assert.deepEqual(details.data.allowedNextStatuses, ['Resolved', 'Closed', 'Rejected']);
  });

  await t.test('rejects arbitrary and backward statuses, ownership/assignment fields, and invalid remarks', async () => {
    for (const body of [
      { status: 'Invented' },
      { status: 'Assigned' },
      { status: 'Resolved' },                        // missing mandatory remark
      { status: 'Resolved', userId: student.id },    // unexpected field + missing remark
      { status: 'Resolved', assignedStaffId: otherStaff.id }, // unexpected field
      { status: 'Resolved', remark: 42 },
      { status: 'Resolved', remark: 'x'.repeat(2001) },
    ]) {
      const result = await request(`/api/staff/complaints/${assignedComplaintId}/status`, {
        method: 'PATCH',
        token: staff.token,
        body,
      });
      assert.ok([400, 409].includes(result.response.status), JSON.stringify(result.data));
    }
    const [stored] = await db.execute('SELECT status FROM complaints WHERE id = ?', [assignedComplaintId]);
    assert.equal(stored[0].status, 'In Progress');
  });

  await t.test('requires a remark to resolve or close a complaint, and records a notification', async () => {
    // Attempt resolve without remark -> 400
    const noRemark = await request(`/api/staff/complaints/${assignedComplaintId}/status`, {
      method: 'PATCH',
      token: staff.token,
      body: { status: 'Resolved' },
    });
    assert.equal(noRemark.response.status, 400, JSON.stringify(noRemark.data));
    assert.ok(
      noRemark.data.message.toLowerCase().includes('remark'),
      `Expected remark-related error, got: ${noRemark.data.message}`
    );

    // Resolve with a proper remark -> 200 and notification written
    const resolved = await request(`/api/staff/complaints/${assignedComplaintId}/status`, {
      method: 'PATCH',
      token: staff.token,
      body: { status: 'Resolved', remark: 'Issue confirmed and repaired. Fan motor replaced and tested.' },
    });
    assert.equal(resolved.response.status, 200, JSON.stringify(resolved.data));
    assert.equal(resolved.data.complaint.status, 'Resolved');

    // Give the async notification insert a moment to complete
    await new Promise((r) => setTimeout(r, 50));

    // Verify a notification row was created for the student
    const [notifs] = await db.execute(
      `SELECT title, message FROM notifications
       WHERE complaint_id = ? AND user_id = ?
       ORDER BY id DESC LIMIT 1`,
      [assignedComplaintId, student.id]
    );
    assert.ok(notifs.length > 0, 'A notification should have been created for the student');
    assert.ok(notifs[0].title.includes('Status Updated'), `Unexpected title: ${notifs[0].title}`);
    assert.ok(notifs[0].message.includes('Resolved'), `Unexpected message: ${notifs[0].message}`);
  });

  await t.test('rolls back status update if history insertion fails', async () => {
    const originalGetConnection = db.getConnection;
    db.getConnection = async () => {
      const connection = await originalGetConnection();
      return {
        beginTransaction: connection.beginTransaction.bind(connection),
        execute: async (sql, parameters) => {
          if (sql.includes('INSERT INTO complaint_status_history')) {
            throw new Error('Injected status-history insert failure for transaction test.');
          }
          return connection.execute(sql, parameters);
        },
        rollback: connection.rollback.bind(connection),
        release: connection.release.bind(connection),
      };
    };
    try {
      // complaint is now Resolved; attempt to close it (valid forward transition)
      const failed = await request(`/api/staff/complaints/${assignedComplaintId}/status`, {
        method: 'PATCH',
        token: staff.token,
        body: { status: 'Closed', remark: 'This must roll back.' },
      });
      assert.equal(failed.response.status, 500);
      const [stored] = await db.execute(
        'SELECT status FROM complaints WHERE id = ?',
        [assignedComplaintId]
      );
      const [history] = await db.execute(
        'SELECT id FROM complaint_status_history WHERE complaint_id = ?',
        [assignedComplaintId]
      );
      // Status must remain Resolved (not Closed) because transaction was rolled back
      assert.equal(stored[0].status, 'Resolved');
      // History entries: initial assignment + in-progress + resolved = 3
      assert.equal(history.length, 3);
    } finally {
      db.getConnection = originalGetConnection;
    }
  });

  await t.test('does not let staff update an unassigned complaint', async () => {
    const denied = await request(`/api/staff/complaints/${otherStaffComplaintId}/status`, {
      method: 'PATCH',
      token: staff.token,
      body: { status: 'In Progress' },
    });
    assert.equal(denied.response.status, 404);
  });

  await t.test('serves database-driven staff dashboard statistics and isolates staff data', async () => {
    const anonDashboard = await request('/api/staff/dashboard');
    assert.equal(anonDashboard.response.status, 401);

    const studentDashboard = await request('/api/staff/dashboard', { token: student.token });
    assert.equal(studentDashboard.response.status, 403);

    const adminDashboard = await request('/api/staff/dashboard', { token: admin.token });
    assert.equal(adminDashboard.response.status, 403);

    const staffRes = await request('/api/staff/dashboard', { token: staff.token });
    assert.equal(staffRes.response.status, 200, JSON.stringify(staffRes.data));
    assert.equal(typeof staffRes.data.summary, 'object');
    assert.equal(staffRes.data.summary.total_assigned, 1);
    // The complaint was resolved in the previous test sub-case
    assert.equal(staffRes.data.summary.in_progress, 0);
    assert.equal(staffRes.data.summary.resolved, 1);
    assert.equal(staffRes.data.summary.medium_priority, 1);
    assert.equal(staffRes.data.summary.high_priority, 0);
    assert.equal(staffRes.data.summary.urgent_priority, 0);
    assert.ok(Array.isArray(staffRes.data.recent_complaints));
    assert.equal(staffRes.data.recent_complaints.length, 1);
    assert.equal(staffRes.data.recent_complaints[0].id, assignedComplaintId);
    assert.ok(staffRes.data.department);
    assert.equal(staffRes.data.department.id, departmentId);

    const otherStaffRes = await request('/api/staff/dashboard', { token: otherStaff.token });
    assert.equal(otherStaffRes.response.status, 200, JSON.stringify(otherStaffRes.data));
    assert.equal(otherStaffRes.data.summary.total_assigned, 1);
    assert.equal(otherStaffRes.data.summary.assigned, 1);
    assert.equal(otherStaffRes.data.summary.in_progress, 0);
    assert.equal(otherStaffRes.data.recent_complaints[0].id, otherStaffComplaintId);
  });

  await t.test('supports multi-field search, date filtering, and sorting in assigned complaints list', async () => {
    const searchStudent = await request('/api/staff/complaints?search=Phase%206%20Test%20Student', {
      token: staff.token,
    });
    assert.equal(searchStudent.response.status, 200);
    assert.equal(searchStudent.data.complaints.length, 1);
    assert.equal(searchStudent.data.complaints[0].id, assignedComplaintId);

    const searchLocation = await request('/api/staff/complaints?search=North%20campus', {
      token: staff.token,
    });
    assert.equal(searchLocation.response.status, 200);
    assert.equal(searchLocation.data.complaints.length, 1);

    const searchDesc = await request('/api/staff/complaints?search=Staff%20integration%20test%20complaint', {
      token: staff.token,
    });
    assert.equal(searchDesc.response.status, 200);
    assert.equal(searchDesc.data.complaints.length, 1);

    const searchNone = await request('/api/staff/complaints?search=NonexistentQueryXYZ', {
      token: staff.token,
    });
    assert.equal(searchNone.response.status, 200);
    assert.equal(searchNone.data.complaints.length, 0);

    const today = new Date().toISOString().slice(0, 10);
    const dateList = await request(`/api/staff/complaints?startDate=${today}&endDate=${today}`, {
      token: staff.token,
    });
    assert.equal(dateList.response.status, 200);
    assert.equal(dateList.data.complaints.length, 1);

    const invalidDate = await request('/api/staff/complaints?startDate=invalid-date', {
      token: staff.token,
    });
    assert.equal(invalidDate.response.status, 400);

    for (const sortField of ['location', 'category', 'student_name']) {
      const sorted = await request(`/api/staff/complaints?sortBy=${sortField}&sortOrder=asc`, {
        token: staff.token,
      });
      assert.equal(sorted.response.status, 200);
      assert.equal(sorted.data.complaints.length, 1);
    }
  });

  await t.test('returns full complaint details including student info and assignments', async () => {
    const details = await request(`/api/staff/complaints/${assignedComplaintId}`, { token: staff.token });
    assert.equal(details.response.status, 200);
    assert.equal(details.data.complaint.student_name, 'Phase 6 Test Student');
    assert.equal(details.data.complaint.assigned_staff_id, staff.id);
    assert.equal(details.data.complaint.assigned_staff_name, 'Phase 6 Assigned Staff');
    assert.equal(details.data.complaint.assigned_department_id, departmentId);
    assert.ok(details.data.complaint.department_name.startsWith('Staff Test Department'));
    assert.equal(details.data.complaint.location, 'North campus');
    assert.ok(Array.isArray(details.data.history));
    assert.ok(Array.isArray(details.data.attachments));
  });
});
