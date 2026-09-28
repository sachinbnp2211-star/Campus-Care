const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const fs = require('fs/promises');
const path = require('path');
const app = require('../app');
const db = require('../config/db');

const server = app.listen(0, '127.0.0.1');
const ownerAccounts = [];
const complaintIds = [];
let baseUrl;
let categoryId;
let departmentId;

const request = async (pathname, { method = 'GET', token, body } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
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

const registerStudent = async (email) => {
  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Complaint Integration Student',
      email,
      password: 'temporary-complaint-test-password',
    },
  });
  assert.equal(registration.response.status, 201, JSON.stringify(registration.data));

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'temporary-complaint-test-password' },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const account = { id: login.data.user.id, token: login.data.token, email };
  ownerAccounts.push(account);
  return account;
};

const createComplaint = async (token, title, { attachment } = {}) => {
  const form = new FormData();
  form.set('title', title);
  form.set('description', `Detailed report for ${title}.`);
  form.set('location', 'Engineering block, room 204');
  form.set('categoryId', String(categoryId));
  form.set('departmentId', String(departmentId));
  form.set('priority', 'High');
  if (attachment) {
    form.append(
      'attachments',
      new Blob([attachment.bytes], { type: attachment.mimeType }),
      attachment.fileName
    );
  }
  const result = await request('/api/complaints', { method: 'POST', token, body: form });
  if (result.data.complaint?.id) complaintIds.push(result.data.complaint.id);
  return result;
};

before(async () => {
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const [categories] = await db.execute(
    'SELECT id, department_id FROM categories WHERE department_id IS NOT NULL AND is_active = TRUE ORDER BY id LIMIT 1'
  );
  assert.ok(categories.length, 'Phase 2 categories must exist');
  categoryId = categories[0].id;
  departmentId = categories[0].department_id;

  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const student = await registerStudent(`complaint-owner-${unique}@example.test`);
  const otherStudent = await registerStudent(`complaint-other-${unique}@example.test`);
  ownerAccounts.push({ main: student, other: otherStudent });
});

after(async () => {
  const owners = ownerAccounts.filter((account) => Number.isInteger(Number(account.id)));
  for (const owner of owners) {
    try {
      const [rows] = await db.execute(
        `SELECT a.file_path
         FROM complaint_attachments a
         INNER JOIN complaints c ON c.id = a.complaint_id
         WHERE c.user_id = ?`,
        [owner.id]
      );
      for (const row of rows) {
        await fs.unlink(path.resolve(__dirname, '..', row.file_path)).catch(() => {});
      }
      await db.execute('DELETE FROM complaints WHERE user_id = ?', [owner.id]);
      await db.execute('DELETE FROM users WHERE id = ?', [owner.id]);
    } catch (error) {
      console.error(`Integration test cleanup failed for a test account: ${error.message}`);
    }
  }
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('student complaint creation, retrieval, attachment access, filters, and authorization', async (t) => {
  const [student, otherStudent] = ownerAccounts[ownerAccounts.length - 1]
    ? [
      ownerAccounts[ownerAccounts.length - 1].main,
      ownerAccounts[ownerAccounts.length - 1].other,
    ]
    : [];

  let created;
  let otherComplaint;
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG1sAAAAASUVORK5CYII=',
    'base64'
  );

  await t.test('rejects missing or invalid authentication', async () => {
    const absent = await request('/api/complaints');
    assert.equal(absent.response.status, 401);

    const invalid = await request('/api/complaints', {
      token: 'invalid.jwt.token',
    });
    assert.equal(invalid.response.status, 401);
  });

  await t.test('validates categories, departments, and complaint input', async () => {
    const missing = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {},
    });
    assert.equal(missing.response.status, 400);

    const invalidCategory = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'Invalid category',
        description: 'A detailed report.',
        location: 'Room 1',
        categoryId: 2147483647,
      },
    });
    assert.equal(invalidCategory.response.status, 400);
    assert.match(invalidCategory.data.message, /Category/);

    const spoofedStaff = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'Spoofed assignment',
        description: 'A detailed report.',
        location: 'Room 1',
        categoryId,
        assigned_staff_id: 1,
      },
    });
    assert.equal(spoofedStaff.response.status, 400);
    assert.match(spoofedStaff.data.message, /cannot be set/);

    const spoofed = await request('/api/complaints', {
      method: 'POST',
      token: student.token,
      body: {
        title: 'Spoofed ownership',
        description: 'A detailed report.',
        location: 'Room 1',
        categoryId,
        user_id: otherStudent.id,
      },
    });
    assert.equal(spoofed.response.status, 400);
    assert.match(spoofed.data.message, /cannot be set/);
  });

  await t.test('creates a complaint with a generated number, submitted status, history, and attachment', async () => {
    const result = await createComplaint(student.token, 'Integration test electrical fault', {
      attachment: {
        bytes: pngBytes,
        mimeType: 'image/png',
        fileName: 'evidence.png',
      },
    });

    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    created = result.data.complaint;
    assert.match(created.complaint_number, /^CMP-\d{4}-\d{5,}$/);
    assert.equal(created.status, 'Submitted');
    assert.equal(created.priority, 'High');
    assert.equal(created.category_id, categoryId);
    assert.equal(created.department_id, departmentId);
    assert.equal(Object.hasOwn(created, 'user_id'), false);
    assert.equal(result.data.attachments.length, 1);
    assert.equal(result.data.attachments[0].file_name, 'evidence.png');

    const [stored] = await db.execute(
      `SELECT id, complaint_number, user_id, status, priority
       FROM complaints
       WHERE id = ?`,
      [created.id]
    );
    assert.equal(stored.length, 1);
    assert.equal(Number(stored[0].user_id), Number(student.id));
    assert.equal(stored[0].complaint_number, created.complaint_number);
    assert.equal(stored[0].status, 'Submitted');
    assert.equal(stored[0].priority, 'High');

    const [history] = await db.execute(
      `SELECT previous_status, new_status, changed_by, remark
       FROM complaint_status_history
       WHERE complaint_id = ?`,
      [created.id]
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].previous_status, null);
    assert.equal(history[0].new_status, 'Submitted');
    assert.equal(Number(history[0].changed_by), Number(student.id));

    const [attachmentRows] = await db.execute(
      'SELECT file_name, file_path, uploaded_by FROM complaint_attachments WHERE complaint_id = ?',
      [created.id]
    );
    assert.equal(attachmentRows.length, 1);
    assert.equal(attachmentRows[0].file_name, 'evidence.png');
    assert.equal(Number(attachmentRows[0].uploaded_by), Number(student.id));
    assert.ok(!path.isAbsolute(attachmentRows[0].file_path));
  });

  await t.test('rejects executable or mismatched attachment content', async () => {
    const invalid = await createComplaint(student.token, 'Invalid upload', {
      attachment: {
        bytes: Buffer.from('not a PNG executable payload'),
        mimeType: 'image/png',
        fileName: 'not-really-an-image.png',
      },
    });
    assert.equal(invalid.response.status, 400);
    assert.match(invalid.data.message, /does not match/);
  });

  await t.test('lists only the owner’s complaints with search, filters, sorting, and pagination', async () => {
    const second = await createComplaint(student.token, 'Integration test plumbing leak');
    assert.equal(second.response.status, 201, JSON.stringify(second.data));
    const secondComplaint = second.data.complaint;

    const list = await request('/api/complaints?limit=1&page=1&sortBy=created_at&sortOrder=desc', {
      token: student.token,
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.pagination.total, 2);
    assert.equal(list.data.pagination.limit, 1);
    assert.equal(list.data.pagination.page, 1);
    assert.equal(list.data.complaints.length, 1);

    const search = await request(`/api/complaints?search=${encodeURIComponent(created.complaint_number)}`, {
      token: student.token,
    });
    assert.equal(search.response.status, 200);
    assert.equal(search.data.complaints.length, 1);
    assert.equal(search.data.complaints[0].id, created.id);

    const filtered = await request(
      `/api/complaints?category=${categoryId}&department=${departmentId}&priority=High&status=Submitted`,
      { token: student.token }
    );
    assert.equal(filtered.response.status, 200);
    assert.ok(filtered.data.complaints.some((item) => item.id === created.id));
    assert.ok(filtered.data.complaints.every((item) => item.status === 'Submitted'));

    const invalidSort = await request('/api/complaints?sortBy=complaint_number;DROP%20TABLE%20users', {
      token: student.token,
    });
    assert.equal(invalidSort.response.status, 400);

    const otherStudentList = await request('/api/complaints', { token: otherStudent.token });
    assert.equal(otherStudentList.response.status, 200);
    assert.equal(otherStudentList.data.pagination.total, 0);

    const secondOwnerComplaint = await createComplaint(otherStudent.token, 'Other student private issue');
    assert.equal(secondOwnerComplaint.response.status, 201);
    otherComplaint = secondOwnerComplaint.data.complaint;
  });

  await t.test('returns details and attachment only to the owning student', async () => {
    const ownDetails = await request(`/api/complaints/${created.id}`, { token: student.token });
    assert.equal(ownDetails.response.status, 200);
    assert.equal(ownDetails.data.complaint.id, created.id);
    assert.equal(ownDetails.data.history.length, 1);
    assert.equal(ownDetails.data.history[0].new_status, 'Submitted');
    assert.equal(ownDetails.data.attachments.length, 1);

    const fileUrl = ownDetails.data.attachments[0].url;
    const download = await request(fileUrl, { token: student.token });
    assert.equal(download.response.status, 200);
    assert.ok(download.data.equals(pngBytes));

    const otherDetails = await request(`/api/complaints/${created.id}`, { token: otherStudent.token });
    assert.equal(otherDetails.response.status, 403);
    const foreignAttachment = await request(fileUrl, { token: otherStudent.token });
    assert.equal(foreignAttachment.response.status, 404);

    const invalidId = await request('/api/complaints/not-an-id', { token: student.token });
    assert.equal(invalidId.response.status, 400);
    const missingId = await request('/api/complaints/2147483647', { token: student.token });
    assert.equal(missingId.response.status, 404);
  });

  await t.test('allows safe own edits while preventing owner, role, status, and foreign-record changes', async () => {
    const foreignUpdate = await request(`/api/complaints/${otherComplaint.id}`, {
      method: 'PUT',
      token: student.token,
      body: { title: 'Attempt to edit another student complaint' },
    });
    assert.equal(foreignUpdate.response.status, 403);

    const protectedFieldUpdate = await request(`/api/complaints/${created.id}`, {
      method: 'PUT',
      token: student.token,
      body: { status: 'Resolved' },
    });
    assert.equal(protectedFieldUpdate.response.status, 400);

    const ownerFieldUpdate = await request(`/api/complaints/${created.id}`, {
      method: 'PUT',
      token: student.token,
      body: { user_id: otherStudent.id, role: 'admin' },
    });
    assert.equal(ownerFieldUpdate.response.status, 400);

    const statusUpdate = await request(`/api/complaints/${created.id}/status`, {
      method: 'PUT',
      token: student.token,
      body: { status: 'Resolved' },
    });
    assert.equal(statusUpdate.response.status, 403);

    const ownUpdate = await request(`/api/complaints/${created.id}`, {
      method: 'PUT',
      token: student.token,
      body: { title: 'Updated while submitted' },
    });
    assert.equal(ownUpdate.response.status, 200);
    assert.equal(ownUpdate.data.complaint.title, 'Updated while submitted');

    const [protectedComplaint] = await db.execute(
      'SELECT user_id, status FROM complaints WHERE id = ?',
      [created.id]
    );
    assert.equal(Number(protectedComplaint[0].user_id), Number(student.id));
    assert.equal(protectedComplaint[0].status, 'Submitted');

    const [history] = await db.execute(
      'SELECT COUNT(*) AS total FROM complaint_status_history WHERE complaint_id = ?',
      [created.id]
    );
    assert.equal(Number(history[0].total), 1);
  });
});
