const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('../config/db');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-five-integration-test-secret-0123456789';

const server = app.listen(0, '127.0.0.1');
const createdUserIds = [];
let baseUrl;
let admin;
let student;
let staffId;
let complaintId;
let categoryId;
let departmentId;
let otherDepartmentId;
let categoryName;
let departmentName;
let otherDepartmentName;

const request = async (pathname, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers, body: payload });
  return { response, data: await response.json() };
};

const createAccount = async ({ email, role, department = null, name }) => {
  const password = 'phase-five-test-password';
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, role, department_id)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, role, department]
  );
  createdUserIds.push(result.insertId);
  return { id: result.insertId, email, password };
};

const login = async (account) => {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return { ...account, token: result.data.token };
};

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  categoryName = `Admin Test Category ${suffix}`;
  departmentName = `Admin Test Department ${suffix}`;
  otherDepartmentName = `Admin Test Other Department ${suffix}`;

  const [departmentResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [departmentName, 'Disposable Phase 5 integration fixture']
  );
  departmentId = departmentResult.insertId;
  const [otherDepartmentResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [otherDepartmentName, 'Disposable Phase 5 integration fixture']
  );
  otherDepartmentId = otherDepartmentResult.insertId;
  const [categoryResult] = await db.execute(
    'INSERT INTO categories (name, description) VALUES (?, ?)',
    [categoryName, 'Disposable Phase 5 integration fixture']
  );
  categoryId = categoryResult.insertId;

  const adminAccount = await createAccount({
    email: `phase5-admin-${suffix}@example.test`,
    role: 'admin',
    name: 'Phase 5 Test Admin',
  });
  const studentAccount = await createAccount({
    email: `phase5-student-${suffix}@example.test`,
    role: 'student',
    name: 'Phase 5 Test Student',
  });
  const staffAccount = await createAccount({
    email: `phase5-staff-${suffix}@example.test`,
    role: 'staff',
    department: departmentId,
    name: 'Phase 5 Test Staff',
  });
  admin = await login(adminAccount);
  student = await login(studentAccount);
  staffId = staffAccount.id;

  const [complaintResult] = await db.execute(
    `INSERT INTO complaints
     (complaint_number, user_id, category_id, title, description, location, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Medium', 'Submitted')`,
    [`ADMINTEST-${suffix}`, student.id, categoryId, 'Phase 5 admin complaint', 'Test detail', 'Test location']
  );
  complaintId = complaintResult.insertId;
  await db.execute(
    `INSERT INTO complaint_status_history
     (complaint_id, previous_status, new_status, changed_by, remark)
     VALUES (?, NULL, 'Submitted', ?, 'Test complaint submitted.')`,
    [complaintId, student.id]
  );
});

after(async () => {
  if (complaintId) await db.execute('DELETE FROM complaints WHERE id = ?', [complaintId]);
  for (const id of createdUserIds) await db.execute('DELETE FROM users WHERE id = ?', [id]);
  if (categoryId) await db.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
  if (departmentId) await db.execute('DELETE FROM departments WHERE id = ?', [departmentId]);
  if (otherDepartmentId) await db.execute('DELETE FROM departments WHERE id = ?', [otherDepartmentId]);
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('admin-only Phase 5 APIs support review, assignment, and reference management', async (t) => {
  await t.test('requires an authenticated administrator', async () => {
    const unauthenticated = await request('/api/admin/complaints');
    assert.equal(unauthenticated.response.status, 401);
    const studentDenied = await request('/api/admin/complaints', { token: student.token });
    assert.equal(studentDenied.response.status, 403);
  });

  await t.test('serves database-backed dashboard and paginated complaint list', async () => {
    const dashboard = await request('/api/admin/dashboard', { token: admin.token });
    assert.equal(dashboard.response.status, 200);
    assert.ok(Number(dashboard.data.stats.total_complaints) >= 1);
    assert.ok(Array.isArray(dashboard.data.categoryStats));

    const list = await request('/api/admin/complaints?search=Phase%205%20admin&page=1&limit=5', {
      token: admin.token,
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.complaints[0].id, complaintId);
    assert.equal(list.data.pagination.page, 1);
    assert.equal(list.data.pagination.limit, 5);

    const invalidFilter = await request('/api/admin/complaints?status=Invented', { token: admin.token });
    assert.equal(invalidFilter.response.status, 400);
  });

  await t.test('validates updates and records status history while assigning staff', async () => {
    const invalidStatus = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: { status: 'Invented' },
    });
    assert.equal(invalidStatus.response.status, 400);

    const invalidStaff = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: { departmentId: otherDepartmentId, staffId },
    });
    assert.equal(invalidStaff.response.status, 400);

    const changed = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        departmentId,
        staffId,
        priority: 'Urgent',
        remark: 'Assigned during integration test.',
      },
    });
    assert.equal(changed.response.status, 200, JSON.stringify(changed.data));
    assert.equal(changed.data.complaint.status, 'Assigned');
    assert.equal(changed.data.complaint.priority, 'Urgent');
    assert.equal(changed.data.complaint.assigned_staff_id, staffId);

    const [history] = await db.execute(
      'SELECT previous_status, new_status, changed_by, remark FROM complaint_status_history WHERE complaint_id = ? ORDER BY id',
      [complaintId]
    );
    assert.equal(history.length, 2);
    assert.equal(history[1].previous_status, 'Submitted');
    assert.equal(history[1].new_status, 'Assigned');
    assert.equal(history[1].changed_by, admin.id);
  });

  await t.test('supports safe user and department/category administration', async () => {
    const users = await request('/api/admin/users', { token: admin.token });
    assert.equal(users.response.status, 200);
    const testStudent = users.data.users.find((user) => user.id === student.id);
    assert.equal(testStudent.role, 'student');
    assert.equal(Object.hasOwn(testStudent, 'password'), false);

    const userUpdate = await request(`/api/admin/users/${student.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'staff', departmentId },
    });
    assert.equal(userUpdate.response.status, 200, JSON.stringify(userUpdate.data));
    assert.equal(userUpdate.data.user.role, 'staff');
    assert.equal(userUpdate.data.user.department_id, departmentId);

    const selfRoleChange = await request(`/api/admin/users/${admin.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'student' },
    });
    assert.equal(selfRoleChange.response.status, 400);

    const invalidUserUpdate = await request(`/api/admin/users/${student.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'superuser' },
    });
    assert.equal(invalidUserUpdate.response.status, 400);

    const renamedDepartment = `${departmentName} Updated`;
    const departmentUpdate = await request(`/api/admin/departments/${departmentId}`, {
      method: 'PUT',
      token: admin.token,
      body: { name: renamedDepartment, description: 'Updated by test' },
    });
    assert.equal(departmentUpdate.response.status, 200);
    departmentName = renamedDepartment;

    const renamedCategory = `${categoryName} Updated`;
    const categoryUpdate = await request(`/api/admin/categories/${categoryId}`, {
      method: 'PUT',
      token: admin.token,
      body: { name: renamedCategory, description: 'Updated by test' },
    });
    assert.equal(categoryUpdate.response.status, 200);
    categoryName = renamedCategory;

    const duplicate = await request('/api/admin/categories', {
      method: 'POST',
      token: admin.token,
      body: { name: categoryName, description: '' },
    });
    assert.equal(duplicate.response.status, 409);
  });
});
