const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const app = require('../app');

let baseUrl;
let server;
const createdUserIds = [];
const createdComplaintIds = [];
const createdCategoryIds = [];
const createdDepartmentIds = [];
const writtenFiles = [];

const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

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

const createAccount = async ({ name, email, password = 'Password123!', role, department_id = null, status = 'Active', student_id = null }) => {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, phone, student_id, role, department_id, status)
     VALUES (?, ?, ?, '9000000000', ?, ?, ?, ?)`,
    [name, email, hash, student_id, role, department_id, status]
  );
  createdUserIds.push(result.insertId);

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return {
    id: result.insertId,
    name,
    email,
    password,
    role,
    department_id,
    token: loginRes.data.token,
  };
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
    await db.execute('DELETE FROM complaint_attachments WHERE complaint_id = ?', [id]).catch(() => {});
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
  for (const file of writtenFiles) {
    await fs.unlink(path.join(uploadDir, file)).catch(() => {});
  }

  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('Full Security and Access-Control Audit Suite', async (t) => {
  const suffix = Date.now().toString(36);

  // Setup departments & category
  const [deptResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [`AuditDept-${suffix}`, 'Audit Department']
  );
  const deptId = deptResult.insertId;
  createdDepartmentIds.push(deptId);

  const [catResult] = await db.execute(
    'INSERT INTO categories (name, description, department_id, is_active) VALUES (?, ?, ?, TRUE)',
    [`AuditCat-${suffix}`, 'Audit Category', deptId]
  );
  const catId = catResult.insertId;
  createdCategoryIds.push(catId);

  // Setup user accounts across all roles
  const admin = await createAccount({
    name: 'Audit Admin',
    email: `audit-admin-${suffix}@campus.test`,
    role: 'admin',
  });

  const studentA = await createAccount({
    name: 'Audit Student A',
    email: `audit-student-a-${suffix}@campus.test`,
    role: 'student',
    student_id: `STU-AUD-A-${suffix}`,
  });

  const studentB = await createAccount({
    name: 'Audit Student B',
    email: `audit-student-b-${suffix}@campus.test`,
    role: 'student',
    student_id: `STU-AUD-B-${suffix}`,
  });

  const staffA = await createAccount({
    name: 'Audit Staff A',
    email: `audit-staff-a-${suffix}@campus.test`,
    role: 'staff',
    department_id: deptId,
  });

  const staffB = await createAccount({
    name: 'Audit Staff B',
    email: `audit-staff-b-${suffix}@campus.test`,
    role: 'staff',
    department_id: deptId,
  });

  // Create complaint owned by Student A and assigned to Staff A
  const createComplaintRes = await request('/api/complaints', {
    method: 'POST',
    token: studentA.token,
    body: {
      title: 'Student A Complaint for IDOR testing',
      description: 'Confidential complaint details.',
      location: 'Block A, Room 101',
      categoryId: catId,
      priority: 'High',
    },
  });
  assert.equal(createComplaintRes.response.status, 201);
  const complaintAId = createComplaintRes.data.complaint.id;
  createdComplaintIds.push(complaintAId);

  // Admin assigns complaint to Staff A
  const assignRes = await request(`/api/admin/complaints/${complaintAId}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      departmentId: deptId,
      staffId: staffA.id,
      priority: 'High',
    },
  });
  assert.equal(assignRes.response.status, 200);

  // Attach a mock file to Complaint A directly for attachment IDOR testing
  const testFileName = `sec-evidence-${suffix}.png`;
  const testStoredName = `test-file-${suffix}.png`;
  await fs.writeFile(path.join(uploadDir, testStoredName), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  writtenFiles.push(testStoredName);

  const [attResult] = await db.execute(
    'INSERT INTO complaint_attachments (complaint_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?)',
    [complaintAId, testFileName, testStoredName, studentA.id]
  );
  const attachmentId = attResult.insertId;

  // =========================================================================
  // 1. Role-Based Access Control (RBAC) Matrix
  // =========================================================================
  await t.test('RBAC: Student cannot access Admin or Staff endpoints', async () => {
    const adminEndpoints = [
      '/api/admin/dashboard',
      '/api/admin/complaints',
      '/api/admin/staff',
      '/api/admin/users',
      '/api/admin/categories',
      '/api/admin/departments',
    ];
    for (const ep of adminEndpoints) {
      const res = await request(ep, { token: studentA.token });
      assert.equal(res.response.status, 403, `Student accessing ${ep} must return 403`);
    }

    const staffEndpoints = [
      '/api/staff/dashboard',
      '/api/staff/complaints',
      '/api/staff/categories',
    ];
    for (const ep of staffEndpoints) {
      const res = await request(ep, { token: studentA.token });
      assert.equal(res.response.status, 403, `Student accessing ${ep} must return 403`);
    }
  });

  await t.test('RBAC: Staff cannot access Admin or Student endpoints', async () => {
    const adminEndpoints = [
      '/api/admin/dashboard',
      '/api/admin/complaints',
      '/api/admin/staff',
      '/api/admin/users',
      '/api/admin/categories',
      '/api/admin/departments',
    ];
    for (const ep of adminEndpoints) {
      const res = await request(ep, { token: staffA.token });
      assert.equal(res.response.status, 403, `Staff accessing ${ep} must return 403`);
    }

    const studentEndpoints = [
      { method: 'GET', path: '/api/complaints' },
      { method: 'POST', path: '/api/complaints', body: { title: 'Test', description: 'Test', location: 'Test', categoryId: catId } },
    ];
    for (const ep of studentEndpoints) {
      const res = await request(ep.path, { method: ep.method, token: staffA.token, body: ep.body });
      assert.equal(res.response.status, 403, `Staff accessing ${ep.method} ${ep.path} must return 403`);
    }
  });

  await t.test('RBAC: Unauthenticated requests are denied across protected routes', async () => {
    const protectedRoutes = [
      '/api/complaints',
      '/api/staff/dashboard',
      '/api/admin/dashboard',
      '/api/auth/me',
    ];
    for (const route of protectedRoutes) {
      const res = await request(route);
      assert.equal(res.response.status, 401, `Unauthenticated request to ${route} must return 401`);
    }
  });

  // =========================================================================
  // 2. IDOR Protection (Student vs Student)
  // =========================================================================
  await t.test('IDOR: Student B cannot view Student A complaint details (403)', async () => {
    const res = await request(`/api/complaints/${complaintAId}`, { token: studentB.token });
    assert.equal(res.response.status, 403);
    assert.match(res.data.message, /not allowed to view/i);
  });

  await t.test('IDOR: Student B cannot modify Student A complaint (403)', async () => {
    const res = await request(`/api/complaints/${complaintAId}`, {
      method: 'PUT',
      token: studentB.token,
      body: { title: 'Hacked Title' },
    });
    assert.equal(res.response.status, 403);
    assert.match(res.data.message, /not allowed to modify/i);
  });

  await t.test('IDOR: Student B cannot download Student A complaint attachment (404)', async () => {
    const res = await request(`/api/complaints/${complaintAId}/attachments/${attachmentId}`, {
      token: studentB.token,
    });
    assert.equal(res.response.status, 404);
  });

  // =========================================================================
  // 3. IDOR Protection (Staff vs Staff)
  // =========================================================================
  await t.test('IDOR: Staff B cannot view complaint assigned to Staff A (404)', async () => {
    const res = await request(`/api/staff/complaints/${complaintAId}`, { token: staffB.token });
    assert.equal(res.response.status, 404);
  });

  await t.test('IDOR: Staff B cannot update status of complaint assigned to Staff A (404)', async () => {
    const res = await request(`/api/staff/complaints/${complaintAId}/status`, {
      method: 'PATCH',
      token: staffB.token,
      body: {
        status: 'In Progress',
        remark: 'Unauthorized update attempt',
      },
    });
    assert.equal(res.response.status, 404);
  });

  await t.test('IDOR: Staff B cannot download attachment of complaint assigned to Staff A (404)', async () => {
    const res = await request(`/api/staff/complaints/${complaintAId}/attachments/${attachmentId}`, {
      token: staffB.token,
    });
    assert.equal(res.response.status, 404);
  });

  // =========================================================================
  // 4. Complaint Integrity & Business Rules
  // =========================================================================
  await t.test('Complaint Integrity: Student cannot change complaint status directly (403)', async () => {
    const res = await request(`/api/complaints/${complaintAId}/status`, {
      method: 'PUT',
      token: studentA.token,
      body: { status: 'Resolved' },
    });
    assert.equal(res.response.status, 403);
  });

  await t.test('Complaint Integrity: Student cannot edit complaint once status is Assigned or beyond (409)', async () => {
    const res = await request(`/api/complaints/${complaintAId}`, {
      method: 'PUT',
      token: studentA.token,
      body: { title: 'Late title edit' },
    });
    assert.equal(res.response.status, 409);
    assert.match(res.data.message, /only be edited while its status is Submitted/i);
  });

  await t.test('Complaint Integrity: Student cannot inject unauthorized fields (assigned_staff_id, status, user_id)', async () => {
    const spoofAttempt = await request('/api/complaints', {
      method: 'POST',
      token: studentA.token,
      body: {
        title: 'Spoof injection test',
        description: 'Detail',
        location: 'Room 1',
        categoryId: catId,
        assigned_staff_id: staffA.id,
      },
    });
    assert.equal(spoofAttempt.response.status, 400);
    assert.match(spoofAttempt.data.message, /cannot be set by a student/i);
  });

  // =========================================================================
  // 5. Authentication & Account Lifecycle Security
  // =========================================================================
  await t.test('Auth: Deactivated user account cannot log in or use active tokens (403)', async () => {
    // Admin deactivates Staff A
    const deactRes = await request(`/api/admin/staff/${staffA.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: { status: 'Inactive' },
    });
    assert.equal(deactRes.response.status, 200);

    // Active JWT token should be rejected on next request
    const tokenRes = await request('/api/staff/dashboard', { token: staffA.token });
    assert.equal(tokenRes.response.status, 403);
    assert.match(tokenRes.data.message, /deactivated/i);

    // Login attempt with correct password should be rejected
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: staffA.email, password: staffA.password },
    });
    assert.equal(loginRes.response.status, 403);
    assert.match(loginRes.data.message, /deactivated/i);

    // Reactivate Staff A
    await request(`/api/admin/staff/${staffA.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: { status: 'Active' },
    });
  });

  await t.test('Admin Safety: Admin cannot change own administrator role (400)', async () => {
    const demoteSelfRes = await request(`/api/admin/users/${admin.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'student' },
    });
    assert.equal(demoteSelfRes.response.status, 400);
    assert.match(demoteSelfRes.data.message, /cannot change your own administrator role/i);
  });
});
