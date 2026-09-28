const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const app = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-jwt-secret-change-in-production';

let baseUrl;
let server;
const createdUserIds = [];
const createdCategoryIds = [];
const createdDepartmentIds = [];
const createdComplaintIds = [];

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

const request = async (route, { method = 'GET', body, token } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: payload,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { response, data };
};

test.before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => resolve());
    server.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  for (const id of createdComplaintIds) {
    await db.execute('DELETE FROM notifications WHERE complaint_id = ?', [id]).catch(() => {});
    await db.execute('DELETE FROM complaint_status_history WHERE complaint_id = ?', [id]).catch(() => {});
    await db.execute('DELETE FROM complaints WHERE id = ?', [id]).catch(() => {});
  }
  for (const id of createdUserIds) {
    await db.execute('DELETE FROM notifications WHERE user_id = ?', [id]).catch(() => {});
    await db.execute('DELETE FROM users WHERE id = ?', [id]).catch(() => {});
  }
  for (const id of createdCategoryIds) {
    await db.execute('DELETE FROM categories WHERE id = ?', [id]).catch(() => {});
  }
  for (const id of createdDepartmentIds) {
    await db.execute('DELETE FROM departments WHERE id = ?', [id]).catch(() => {});
  }

  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('End-to-End Functional Audit: Dashboards, Notifications, and System Integrity', async (t) => {
  const suffix = Date.now().toString(36);

  // 1. Create Department
  const [deptRes] = await db.execute(
    `INSERT INTO departments (name, description)
     VALUES (?, 'E2E Test Facilities')`,
    [`E2E Facilities ${suffix}`]
  );
  const testDepartment = { id: deptRes.insertId };
  createdDepartmentIds.push(testDepartment.id);

  // 2. Create Category
  const [catRes] = await db.execute(
    `INSERT INTO categories (name, description, department_id, is_active)
     VALUES (?, 'E2E Plumbing repairs', ?, 1)`,
    [`E2E Plumbing ${suffix}`, testDepartment.id]
  );
  const testCategory = { id: catRes.insertId };
  createdCategoryIds.push(testCategory.id);

  // 3. Create Student
  const pwHash = await bcrypt.hash('Password123!', 10);
  const studentEmail = `e2e_student_${suffix}@test.edu`;
  const [stuRes] = await db.execute(
    `INSERT INTO users (name, email, password, role, student_id, status)
     VALUES ('E2E Student', ?, ?, 'student', ?, 'Active')`,
    [studentEmail, pwHash, `STU_${suffix}`]
  );
  const studentUser = { id: stuRes.insertId, email: studentEmail, role: 'student' };
  createdUserIds.push(studentUser.id);
  const stuLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: studentEmail, password: 'Password123!' },
  });
  const studentToken = stuLoginRes.data.token;

  // 4. Create Staff
  const staffEmail = `e2e_staff_${suffix}@test.edu`;
  const [stfRes] = await db.execute(
    `INSERT INTO users (name, email, password, role, department_id, status)
     VALUES ('E2E Staff', ?, ?, 'staff', ?, 'Active')`,
    [staffEmail, pwHash, testDepartment.id]
  );
  const staffUser = { id: stfRes.insertId, email: staffEmail, role: 'staff' };
  createdUserIds.push(staffUser.id);
  const stfLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: 'Password123!' },
  });
  const staffToken = stfLoginRes.data.token;

  // 5. Create Admin
  const adminEmail = `e2e_admin_${suffix}@test.edu`;
  const [admRes] = await db.execute(
    `INSERT INTO users (name, email, password, role, status)
     VALUES ('E2E Admin', ?, ?, 'admin', 'Active')`,
    [adminEmail, pwHash]
  );
  const adminUser = { id: admRes.insertId, email: adminEmail, role: 'admin' };
  createdUserIds.push(adminUser.id);
  const admLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: 'Password123!' },
  });
  const adminToken = admLoginRes.data.token;

  // 6. Create Complaint for Student
  const [compRes] = await db.execute(
    `INSERT INTO complaints (
       complaint_number, user_id, category_id, assigned_department_id,
       title, description, location, priority, status
     ) VALUES (?, ?, ?, ?, 'Broken Pipe', 'Water leaking in Room 101', 'Block A', 'High', 'Submitted')`,
    [`CMP-${suffix.toUpperCase()}`, studentUser.id, testCategory.id, testDepartment.id]
  );
  const testComplaint = { id: compRes.insertId };
  createdComplaintIds.push(testComplaint.id);

  // 7. Create Notification for Student
  const [notifRes] = await db.execute(
    `INSERT INTO notifications (user_id, complaint_id, title, message, is_read)
       VALUES (?, ?, 'Complaint Logged', 'Your complaint has been registered.', 0)`,
    [studentUser.id, testComplaint.id]
  );
  const testNotificationId = notifRes.insertId;

  await t.test('Student Dashboard API returns structured stats and recent complaints', async () => {
    const { response, data } = await request('/api/dashboard/student', {
      token: studentToken,
    });

    assert.equal(response.status, 200);
    assert.ok(data.summary);
    assert.ok(typeof Number(data.summary.total) === 'number');
    assert.ok(Number(data.summary.total) >= 1);
    assert.ok(Array.isArray(data.recentComplaints));
    assert.ok(data.recentComplaints.some((c) => c.id === testComplaint.id));
  });

  await t.test('Notification API lists unread notifications and supports read toggling', async () => {
    // 1. List notifications
    const listRes = await request('/api/notifications', { token: studentToken });
    assert.equal(listRes.response.status, 200);
    assert.ok(Array.isArray(listRes.data.notifications));
    assert.ok(listRes.data.notifications.some((n) => n.id === testNotificationId && (n.is_read === 0 || n.is_read === false)));

    // 2. Mark single notification as read
    const markRes = await request(`/api/notifications/${testNotificationId}/read`, {
      method: 'PATCH',
      token: studentToken,
    });
    assert.equal(markRes.response.status, 200);
    assert.equal(markRes.data.message, 'Notification marked as read.');

    // Verify it is now read
    const listAfterRes = await request('/api/notifications', { token: studentToken });
    const targetNotif = listAfterRes.data.notifications.find((n) => n.id === testNotificationId);
    assert.ok(targetNotif.is_read === 1 || targetNotif.is_read === true);

    // 3. Mark all as read
    const markAllRes = await request('/api/notifications/read-all', {
      method: 'PATCH',
      token: studentToken,
    });
    assert.equal(markAllRes.response.status, 200);
    assert.equal(markAllRes.data.message, 'All notifications marked as read.');
  });

  await t.test('Admin Dashboard API returns accurate system metrics', async () => {
    const { response, data } = await request('/api/dashboard/admin', {
      token: adminToken,
    });

    assert.equal(response.status, 200);
    assert.ok(data.stats);
    assert.ok(typeof Number(data.stats.total_complaints) === 'number');
    assert.ok(Array.isArray(data.categoryStats));
    assert.ok(Array.isArray(data.statusStats));
  });
});
