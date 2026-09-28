const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const db = require('../config/db');
const app = require('../app');

let baseUrl;
let server;
const createdUserIds = [];
const createdCategoryIds = [];
const createdDepartmentIds = [];
const createdComplaintIds = [];

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

const createAccount = async ({ name, email, password = 'Password123!', role, department_id, status = 'Active', student_id }) => {
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.execute(
    `INSERT INTO users (name, email, password, phone, student_id, role, department_id, status)
     VALUES (?, ?, ?, '9000099999', ?, ?, ?, ?)`,
    [name, email, hash, student_id || null, role, department_id || null, status]
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

  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('Category → Responsible Department Routing scenario and security rules', async (t) => {
  const suffix = Date.now().toString(36);

  // Setup departments: Transportation & Electrical
  const [transportDeptResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [`Transportation-${suffix}`, 'Campus transportation services']
  );
  const transportDeptId = transportDeptResult.insertId;
  createdDepartmentIds.push(transportDeptId);

  const [electricalDeptResult] = await db.execute(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
    [`ElectricalDept-${suffix}`, 'Electrical maintenance']
  );
  const electricalDeptId = electricalDeptResult.insertId;
  createdDepartmentIds.push(electricalDeptId);

  // Setup categories: Transportation -> transportDeptId, Unmapped -> NULL
  const [transportCatResult] = await db.execute(
    'INSERT INTO categories (name, description, department_id, is_active) VALUES (?, ?, ?, TRUE)',
    [`TransportationCat-${suffix}`, 'Bus and commute issues', transportDeptId]
  );
  const transportCatId = transportCatResult.insertId;
  createdCategoryIds.push(transportCatId);

  const [unmappedCatResult] = await db.execute(
    'INSERT INTO categories (name, description, department_id, is_active) VALUES (?, ?, NULL, TRUE)',
    [`UnmappedCat-${suffix}`, 'General inquiries without department', null]
  );
  const unmappedCatId = unmappedCatResult.insertId;
  createdCategoryIds.push(unmappedCatId);

  const [inactiveCatResult] = await db.execute(
    'INSERT INTO categories (name, description, department_id, is_active) VALUES (?, ?, ?, FALSE)',
    [`InactiveCat-${suffix}`, 'Old category not active', transportDeptId]
  );
  const inactiveCatId = inactiveCatResult.insertId;
  createdCategoryIds.push(inactiveCatId);

  // Setup users: Admin, Student, Transport Officer (Active), Inactive Transport Staff, Electrical Staff, Unassigned Staff
  const admin = await createAccount({
    name: 'Admin Routing',
    email: `admin-routing-${suffix}@test.local`,
    role: 'admin',
  });

  const student = await createAccount({
    name: 'Student Commuter',
    email: `student-routing-${suffix}@test.local`,
    role: 'student',
    student_id: `STU-ROUT-${suffix}`,
  });

  const transportOfficer = await createAccount({
    name: 'Transport Officer',
    email: `transport-officer-${suffix}@test.local`,
    role: 'staff',
    department_id: transportDeptId,
    status: 'Active',
  });

  const inactiveTransportStaff = await createAccount({
    name: 'Inactive Transport Staff',
    email: `inactive-transport-${suffix}@test.local`,
    role: 'staff',
    department_id: transportDeptId,
    status: 'Inactive',
  });

  const electricalStaff = await createAccount({
    name: 'Electrical Staff',
    email: `electrician-${suffix}@test.local`,
    role: 'staff',
    department_id: electricalDeptId,
    status: 'Active',
  });

  const unassignedStaff = await createAccount({
    name: 'Unassigned Staff',
    email: `unassigned-staff-${suffix}@test.local`,
    role: 'staff',
    department_id: transportDeptId,
    status: 'Active',
  });

  let complaintId;
  let complaintNumber;

  await t.test('1. Student submits complaint with Transportation category; backend derives department and ignores spoofed departmentId', async () => {
    const createRes = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'College bus route 3 delayed',
        description: 'College bus route 3 has not arrived for the last two days.',
        location: 'Bus Stop North Gate',
        categoryId: transportCatId,
        departmentId: electricalDeptId, // Attempted spoof override to Electrical!
        priority: 'High',
      },
    });

    assert.equal(createRes.response.status, 201, JSON.stringify(createRes.data));
    const complaint = createRes.data.complaint;
    assert.ok(complaint.id);
    complaintId = complaint.id;
    complaintNumber = complaint.complaint_number;
    createdComplaintIds.push(complaintId);

    // Verify department_id was derived from Transportation category, NOT Electrical
    assert.equal(complaint.category_id, transportCatId);
    assert.equal(complaint.department_id, transportDeptId);
    assert.equal(complaint.department_name, `Transportation-${suffix}`);
  });

  await t.test('2. Student cannot submit complaint for inactive category', async () => {
    const inactiveRes = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'Inactive complaint',
        description: 'Testing inactive category submission.',
        location: 'Hall A',
        categoryId: inactiveCatId,
      },
    });

    assert.equal(inactiveRes.response.status, 400);
    assert.match(inactiveRes.data.message, /inactive/i);
  });

  await t.test('3. Unmapped category sets assigned_department_id to NULL', async () => {
    const unmappedRes = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'Unmapped issue',
        description: 'Something without a department.',
        location: 'Main Yard',
        categoryId: unmappedCatId,
      },
    });

    assert.equal(unmappedRes.response.status, 201);
    createdComplaintIds.push(unmappedRes.data.complaint.id);
    assert.equal(unmappedRes.data.complaint.department_id, null);
    assert.equal(unmappedRes.data.complaint.department_name, null);
  });

  await t.test('4. Admin category API returns responsible department info and supports creating/editing categories with department and status', async () => {
    const listRes = await request('/api/admin/categories', { token: admin.token });
    assert.equal(listRes.response.status, 200);
    const foundTransport = listRes.data.categories.find((c) => c.id === transportCatId);
    assert.ok(foundTransport);
    assert.equal(foundTransport.department_id, transportDeptId);
    assert.equal(foundTransport.department_name, `Transportation-${suffix}`);
    assert.equal(foundTransport.is_active, 1);

    // Admin creates new category with department
    const newCatRes = await request('/api/admin/categories', {
      method: 'POST',
      token: admin.token,
      body: {
        name: `Mess Catering-${suffix}`,
        description: 'Mess food quality concerns',
        departmentId: transportDeptId,
        isActive: true,
      },
    });
    assert.equal(newCatRes.response.status, 201);
    assert.equal(newCatRes.data.category.department_id, transportDeptId);
    createdCategoryIds.push(newCatRes.data.category.id);

    // Admin updates category
    const updateCatRes = await request(`/api/admin/categories/${newCatRes.data.category.id}`, {
      method: 'PUT',
      token: admin.token,
      body: {
        name: `Mess Catering-${suffix} Updated`,
        description: 'Updated description',
        departmentId: electricalDeptId,
        isActive: false,
      },
    });
    assert.equal(updateCatRes.response.status, 200);
    assert.equal(updateCatRes.data.category.department_id, electricalDeptId);
    assert.equal(updateCatRes.data.category.is_active, 0);
  });

  await t.test('5. Admin cannot assign Electrical staff to a Transportation complaint (returns 400)', async () => {
    const assignElectrician = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        departmentId: transportDeptId,
        staffId: electricalStaff.id,
      },
    });

    assert.equal(assignElectrician.response.status, 400);
    assert.match(assignElectrician.data.message, /must belong to the assigned department/i);
  });

  await t.test('6. Admin cannot assign Inactive Transportation staff to the complaint (returns 400)', async () => {
    const assignInactive = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        departmentId: transportDeptId,
        staffId: inactiveTransportStaff.id,
      },
    });

    assert.equal(assignInactive.response.status, 400);
    assert.match(assignInactive.data.message, /inactive/i);
  });

  await t.test('7. Admin assigns Transportation complaint to active Transport Officer → Success & notification created', async () => {
    const assignRes = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        departmentId: transportDeptId,
        staffId: transportOfficer.id,
        priority: 'High',
      },
    });

    assert.equal(assignRes.response.status, 200);
    assert.equal(assignRes.data.complaint.assigned_staff_id, transportOfficer.id);
    assert.equal(assignRes.data.complaint.status, 'Assigned');

    // Verify staff notification was inserted
    const [notifications] = await db.execute(
      'SELECT * FROM notifications WHERE user_id = ? AND complaint_id = ?',
      [transportOfficer.id, complaintId]
    );
    assert.ok(notifications.length >= 1, 'Notification should be created for assigned staff');
    assert.match(notifications[0].title, new RegExp(complaintNumber));
  });

  await t.test('8. Transport Officer logs in: complaint appears in their Staff Dashboard and details are viewable', async () => {
    const listRes = await request('/api/staff/complaints', { token: transportOfficer.token });
    assert.equal(listRes.response.status, 200);
    const item = listRes.data.complaints.find((c) => c.id === complaintId);
    assert.ok(item, 'Complaint must appear in assigned staff complaints list');
    assert.equal(item.complaint_number, complaintNumber);

    const detailsRes = await request(`/api/staff/complaints/${complaintId}`, { token: transportOfficer.token });
    assert.equal(detailsRes.response.status, 200);
    assert.equal(detailsRes.data.complaint.id, complaintId);
  });

  await t.test('9. Unassigned staff cannot view or update the complaint', async () => {
    const detailsRes = await request(`/api/staff/complaints/${complaintId}`, { token: unassignedStaff.token });
    assert.equal(detailsRes.response.status, 404);

    const updateRes = await request(`/api/staff/complaints/${complaintId}/status`, {
      method: 'PATCH',
      token: unassignedStaff.token,
      body: {
        status: 'In Progress',
        remark: 'Unassigned staff trying to update',
      },
    });
    assert.equal(updateRes.response.status, 404);
  });

  await t.test('10. Transport Officer updates status: Assigned → In Progress → Resolved with remark', async () => {
    // Assigned -> In Progress
    const inProgressRes = await request(`/api/staff/complaints/${complaintId}/status`, {
      method: 'PATCH',
      token: transportOfficer.token,
      body: {
        status: 'In Progress',
        remark: 'Inspecting bus route schedule with transport team.',
      },
    });
    assert.equal(inProgressRes.response.status, 200);
    assert.equal(inProgressRes.data.complaint.status, 'In Progress');

    // In Progress -> Resolved
    const resolveRes = await request(`/api/staff/complaints/${complaintId}/status`, {
      method: 'PATCH',
      token: transportOfficer.token,
      body: {
        status: 'Resolved',
        remark: 'Route 3 bus driver replaced and bus service resumed on schedule.',
      },
    });
    assert.equal(resolveRes.response.status, 200);
    assert.equal(resolveRes.data.complaint.status, 'Resolved');

    // Verify student receives resolution notification
    const [studentNotifs] = await db.execute(
      'SELECT * FROM notifications WHERE user_id = ? AND complaint_id = ? ORDER BY id DESC',
      [student.id, complaintId]
    );
    assert.ok(studentNotifs.length >= 2, 'Student should receive notification upon resolution');
    assert.match(studentNotifs[0].message, /Route 3 bus driver replaced/);
  });

  await t.test('11. Department reassignment clears assigned staff when changing departments', async () => {
    // Admin reassigns complaint to Electrical department without specifying staff
    const reassignRes = await request(`/api/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      token: admin.token,
      body: {
        departmentId: electricalDeptId,
      },
    });

    assert.equal(reassignRes.response.status, 200);
    assert.equal(reassignRes.data.complaint.assigned_department_id, electricalDeptId);
    assert.equal(reassignRes.data.complaint.assigned_staff_id, null, 'Staff must be cleared when department changes');
  });

  await t.test('12. Security checks: student cannot update status directly', async () => {
    const studentStatusAttempt = await request(`/api/complaints/${complaintId}/status`, {
      method: 'PUT',
      token: student.token,
      body: { status: 'Resolved' },
    });
    assert.equal(studentStatusAttempt.response.status, 403);
  });
});
