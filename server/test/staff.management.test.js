const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('../config/db');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'staff-management-test-secret-0123456789';

const server = app.listen(0, '127.0.0.1');
const createdUserIds = [];
const createdDepartmentIds = [];
let baseUrl;
let admin;
let student;
let existingStaff;
let departmentId;

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

const createAccount = async ({ email, role, department = null, name, status = 'Active' }) => {
  const password = 'test-password-123';
  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, role, department_id, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, passwordHash, role, department, status]
  );
  createdUserIds.push(result.insertId);
  return { id: result.insertId, email, password, role };
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
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const [existingDepts] = await db.execute('SELECT id FROM departments ORDER BY id ASC LIMIT 1');
  departmentId = existingDepts.length ? existingDepts[0].id : 1;

  admin = await login(
    await createAccount({
      email: `admin-${Date.now()}@campus.edu`,
      role: 'admin',
      department: departmentId,
      name: 'Test Admin',
    })
  );

  student = await login(
    await createAccount({
      email: `student-${Date.now()}@campus.edu`,
      role: 'student',
      name: 'Test Student',
    })
  );

  existingStaff = await login(
    await createAccount({
      email: `staff-init-${Date.now()}@campus.edu`,
      role: 'staff',
      department: departmentId,
      name: 'Initial Staff',
    })
  );
});

after(async () => {
  for (const id of createdUserIds) {
    await db.execute('DELETE FROM users WHERE id = ?', [id]).catch(() => {});
  }
  for (const id of createdDepartmentIds) {
    await db.execute('DELETE FROM departments WHERE id = ?', [id]).catch(() => {});
  }
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('RBAC: Only authenticated admin can access staff management endpoints', async () => {
  // 1. Unauthenticated
  const unauth = await request('/api/admin/staff');
  assert.equal(unauth.response.status, 401);

  // 2. Student
  const studentReq = await request('/api/admin/staff', { token: student.token });
  assert.equal(studentReq.response.status, 403);

  // 3. Staff
  const staffReq = await request('/api/admin/staff', { token: existingStaff.token });
  assert.equal(staffReq.response.status, 403);

  // 4. Admin
  const adminReq = await request('/api/admin/staff', { token: admin.token });
  assert.equal(adminReq.response.status, 200);
  assert.ok(Array.isArray(adminReq.data.staff));
});

test('Admin can create new staff with valid details and strict role=staff', async () => {
  const newStaffEmail = `staff-new-${Date.now()}@campus.edu`;
  const initialPassword = 'secureStaffPassword123';

  // Attempt to pass role='student' or role='admin' to verify backend forces 'staff'
  const createRes = await request('/api/admin/staff', {
    method: 'POST',
    token: admin.token,
    body: {
      name: 'Jane Staffer',
      email: newStaffEmail,
      password: initialPassword,
      phone: '9876543210',
      departmentId,
      role: 'admin', // Should be ignored by backend
      status: 'Active',
    },
  });

  assert.equal(createRes.response.status, 201, JSON.stringify(createRes.data));
  assert.ok(createRes.data.staff);
  assert.equal(createRes.data.staff.role, 'staff');
  assert.equal(createRes.data.staff.email, newStaffEmail);
  assert.equal(createRes.data.staff.status, 'Active');
  assert.equal(createRes.data.staff.department_id, departmentId);
  assert.equal(createRes.data.staff.password, undefined);
  createdUserIds.push(createRes.data.staff.id);

  // Verify created staff can authenticate
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: newStaffEmail, password: initialPassword },
  });
  assert.equal(loginRes.response.status, 200);
  assert.equal(loginRes.data.user.role, 'staff');
  assert.ok(loginRes.data.token);

  // Verify duplicate email is rejected
  const dupRes = await request('/api/admin/staff', {
    method: 'POST',
    token: admin.token,
    body: {
      name: 'Duplicate Staff',
      email: newStaffEmail,
      password: 'password123',
    },
  });
  assert.equal(dupRes.response.status, 409);
});

test('Admin can edit staff details (name, email, department, phone, status)', async () => {
  const staffMember = await createAccount({
    email: `staff-edit-${Date.now()}@campus.edu`,
    role: 'staff',
    department: departmentId,
    name: 'Editable Staff',
  });

  const updatedName = 'Updated Staff Name';
  const updatedEmail = `staff-edited-${Date.now()}@campus.edu`;
  const updatedPhone = '9111222333';

  const updateRes = await request(`/api/admin/staff/${staffMember.id}`, {
    method: 'PUT',
    token: admin.token,
    body: {
      name: updatedName,
      email: updatedEmail,
      phone: updatedPhone,
      departmentId,
      status: 'Active',
    },
  });

  assert.equal(updateRes.response.status, 200, JSON.stringify(updateRes.data));
  assert.equal(updateRes.data.staff.name, updatedName);
  assert.equal(updateRes.data.staff.email, updatedEmail);
  assert.equal(updateRes.data.staff.phone, updatedPhone);

  // Verify DB record
  const [rows] = await db.execute('SELECT name, email, phone FROM users WHERE id = ?', [staffMember.id]);
  assert.equal(rows[0].name, updatedName);
  assert.equal(rows[0].email, updatedEmail);
});

test('Admin can deactivate and reactivate staff; deactivated staff cannot authenticate or access staff APIs', async () => {
  const staffEmail = `staff-deact-${Date.now()}@campus.edu`;
  const staffPassword = 'deactPassword123';

  const staffAccount = await login(
    await createAccount({
      email: staffEmail,
      role: 'staff',
      department: departmentId,
      name: 'Deactivatable Staff',
    })
  );
  // Re-hash password for auth test
  const passwordHash = await bcrypt.hash(staffPassword, 10);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [passwordHash, staffAccount.id]);

  // Verify staff can access staff APIs currently
  const beforeDeact = await request('/api/staff/dashboard', { token: staffAccount.token });
  assert.equal(beforeDeact.response.status, 200);

  // Admin deactivates staff
  const deactRes = await request(`/api/admin/staff/${staffAccount.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'Inactive' },
  });
  assert.equal(deactRes.response.status, 200);
  assert.equal(deactRes.data.staff.status, 'Inactive');

  // 1. Staff login fails
  const loginFailRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: staffPassword },
  });
  assert.equal(loginFailRes.response.status, 403);
  assert.ok(loginFailRes.data.message.includes('deactivated'));

  // 2. Existing JWT token is rejected by protect middleware
  const tokenFailRes = await request('/api/staff/dashboard', { token: staffAccount.token });
  assert.equal(tokenFailRes.response.status, 403);
  assert.ok(tokenFailRes.data.message.includes('deactivated'));

  // Reactivate staff
  const reactRes = await request(`/api/admin/staff/${staffAccount.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'Active' },
  });
  assert.equal(reactRes.response.status, 200);
  assert.equal(reactRes.data.staff.status, 'Active');

  // Staff can log in again
  const reactLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: staffPassword },
  });
  assert.equal(reactLoginRes.response.status, 200);
  assert.ok(reactLoginRes.data.token);
});

test('Admin can reset staff password via dedicated endpoint', async () => {
  const staffEmail = `staff-pwreset-${Date.now()}@campus.edu`;
  const initialPassword = 'oldPassword123';
  const newPassword = 'newSecretPassword456';

  const staffAccount = await createAccount({
    email: staffEmail,
    role: 'staff',
    department: departmentId,
    name: 'Password Reset Staff',
  });
  const passwordHash = await bcrypt.hash(initialPassword, 10);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [passwordHash, staffAccount.id]);

  // Verify login with initial password
  const firstLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: initialPassword },
  });
  assert.equal(firstLogin.response.status, 200);

  // Admin resets password
  const resetRes = await request(`/api/admin/staff/${staffAccount.id}/password`, {
    method: 'PATCH',
    token: admin.token,
    body: { password: newPassword },
  });
  assert.equal(resetRes.response.status, 200);

  // Old password must fail
  const oldLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: initialPassword },
  });
  assert.equal(oldLogin.response.status, 401);

  // New password must succeed
  const newLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffEmail, password: newPassword },
  });
  assert.equal(newLogin.response.status, 200);
});

test('Search, department filter, and status filter in Admin Staff List', async () => {
  const deptA = departmentId;
  const [deptBResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [`DeptB-${Date.now()}`, 'Second Dept']
  );
  const deptB = deptBResult.insertId;

  const staffA = await createAccount({
    email: `staff-filterA-${Date.now()}@campus.edu`,
    role: 'staff',
    department: deptA,
    name: 'Alpha Technician',
    status: 'Active',
  });
  const staffB = await createAccount({
    email: `staff-filterB-${Date.now()}@campus.edu`,
    role: 'staff',
    department: deptB,
    name: 'Beta Electrician',
    status: 'Inactive',
  });

  // Filter by search
  const searchRes = await request('/api/admin/staff?search=Alpha', { token: admin.token });
  assert.equal(searchRes.response.status, 200);
  const foundA = searchRes.data.staff.some((s) => s.id === staffA.id);
  const foundB = searchRes.data.staff.some((s) => s.id === staffB.id);
  assert.ok(foundA);
  assert.ok(!foundB);

  // Filter by department
  const deptRes = await request(`/api/admin/staff?departmentId=${deptB}`, { token: admin.token });
  assert.equal(deptRes.response.status, 200);
  assert.ok(deptRes.data.staff.every((s) => s.department_id === deptB));

  // Filter by status
  const inactiveRes = await request('/api/admin/staff?status=Inactive', { token: admin.token });
  assert.equal(inactiveRes.response.status, 200);
  assert.ok(inactiveRes.data.staff.every((s) => s.status === 'Inactive'));

  await db.execute('DELETE FROM departments WHERE id = ?', [deptB]);
});

test('Security Audit: Staff cannot access admin functionality, and staff endpoints do not leak passwords', async () => {
  // 1. Verify staff is denied on all admin endpoints
  const adminEndpoints = [
    { method: 'GET', path: '/api/admin/dashboard' },
    { method: 'GET', path: '/api/admin/complaints' },
    { method: 'GET', path: '/api/admin/users' },
    { method: 'GET', path: '/api/admin/staff' },
    { method: 'POST', path: '/api/admin/staff', body: { name: 'Test', email: 'test@t.com', password: 'password123' } },
    { method: 'PUT', path: `/api/admin/staff/${existingStaff.id}`, body: { name: 'New Name' } },
    { method: 'PATCH', path: `/api/admin/staff/${existingStaff.id}/status`, body: { status: 'Inactive' } },
    { method: 'PATCH', path: `/api/admin/staff/${existingStaff.id}/password`, body: { password: 'newPassword123' } },
    { method: 'GET', path: '/api/admin/categories' },
    { method: 'GET', path: '/api/admin/departments' },
  ];

  for (const ep of adminEndpoints) {
    const res = await request(ep.path, {
      method: ep.method,
      token: existingStaff.token,
      body: ep.body,
    });
    assert.equal(res.response.status, 403, `Staff should be denied on ${ep.method} ${ep.path}`);
  }

  // 2. Verify students are denied on all staff and admin endpoints
  const staffEndpoints = [
    { method: 'GET', path: '/api/staff/dashboard' },
    { method: 'GET', path: '/api/staff/complaints' },
    { method: 'GET', path: '/api/staff/categories' },
  ];

  for (const ep of staffEndpoints) {
    const res = await request(ep.path, {
      method: ep.method,
      token: student.token,
      body: ep.body,
    });
    assert.equal(res.response.status, 403, `Student should be denied on ${ep.method} ${ep.path}`);
  }

  // 3. Verify resetStaffPassword cannot be used to target non-staff (admin or student accounts)
  const resetAdminAttempt = await request(`/api/admin/staff/${admin.id}/password`, {
    method: 'PATCH',
    token: admin.token,
    body: { password: 'newAdminPassword123' },
  });
  assert.equal(resetAdminAttempt.response.status, 404, 'Reset staff password should return 404 for admin user');

  const resetStudentAttempt = await request(`/api/admin/staff/${student.id}/password`, {
    method: 'PATCH',
    token: admin.token,
    body: { password: 'newStudentPassword123' },
  });
  assert.equal(resetStudentAttempt.response.status, 404, 'Reset staff password should return 404 for student user');

  // 4. Verify resetStaffPassword validates password length
  const shortPwRes = await request(`/api/admin/staff/${existingStaff.id}/password`, {
    method: 'PATCH',
    token: admin.token,
    body: { password: 'short' },
  });
  assert.equal(shortPwRes.response.status, 400);

  const longPw = 'a'.repeat(73);
  const longPwRes = await request(`/api/admin/staff/${existingStaff.id}/password`, {
    method: 'PATCH',
    token: admin.token,
    body: { password: longPw },
  });
  assert.equal(longPwRes.response.status, 400);

  // 5. Verify updateStaff rejects password or role injection
  const injectPw = await request(`/api/admin/staff/${existingStaff.id}`, {
    method: 'PUT',
    token: admin.token,
    body: { password: 'maliciousPassword123' },
  });
  assert.equal(injectPw.response.status, 400);
  assert.match(injectPw.data.message, /cannot be changed here/i);

  const injectRole = await request(`/api/admin/staff/${existingStaff.id}`, {
    method: 'PUT',
    token: admin.token,
    body: { role: 'admin' },
  });
  assert.equal(injectRole.response.status, 400);
  assert.match(injectRole.data.message, /cannot be changed here/i);

  // 6. Verify no staff response leaks password or password_hash
  const staffListRes = await request('/api/admin/staff', { token: admin.token });
  assert.equal(staffListRes.response.status, 200);
  for (const s of staffListRes.data.staff) {
    assert.equal(s.password, undefined, 'Password field must not exist in staff list');
    assert.equal(s.password_hash, undefined, 'Password hash field must not exist in staff list');
  }

  const usersListRes = await request('/api/admin/users', { token: admin.token });
  assert.equal(usersListRes.response.status, 200);
  for (const u of usersListRes.data.users) {
    assert.equal(u.password, undefined, 'Password field must not exist in user list');
    assert.equal(u.password_hash, undefined, 'Password hash field must not exist in user list');
  }
});

test('Student category and department endpoints return only legitimate records without internal test identifiers', async () => {
  const deptsRes = await request('/api/complaints/departments', { token: student.token });
  assert.equal(deptsRes.response.status, 200);
  assert.ok(Array.isArray(deptsRes.data.departments));
  assert.ok(deptsRes.data.departments.length > 0);

  const catsRes = await request('/api/complaints/categories', { token: student.token });
  assert.equal(catsRes.response.status, 200);
  assert.ok(Array.isArray(catsRes.data.categories));
  assert.ok(catsRes.data.categories.length > 0);

  // Verify internal staff-management / test identifiers never leak into student responses
  const hasStaffMgmtDept = deptsRes.data.departments.some((d) =>
    /staffmanagement|staffmgmtdept|testdept/i.test(d.name)
  );
  assert.equal(hasStaffMgmtDept, false, 'Student department list must not contain internal staff-management identifiers');

  const hasStaffMgmtCat = catsRes.data.categories.some((c) =>
    /staffmanagement|staffmgmtdept|testcat/i.test(c.name)
  );
  assert.equal(hasStaffMgmtCat, false, 'Student category list must not contain internal staff-management identifiers');
});

