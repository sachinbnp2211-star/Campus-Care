const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'phase-three-test-secret-with-more-than-32-characters';

const records = [];
let nextUserId = 1;

const safeColumns = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const fakeDb = {
  async execute(sql, parameters = []) {
    const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (statement.startsWith('select id from users where email =')) {
      const user = records.find((candidate) => candidate.email === parameters[0]);
      return [user ? [{ id: user.id }] : []];
    }

    if (statement.startsWith('select id from users where student_id =')) {
      const user = records.find((candidate) => candidate.student_id === parameters[0]);
      return [user ? [{ id: user.id }] : []];
    }

    if (statement.startsWith('select id from departments where id =')) {
      return [parameters[0] === 7 ? [{ id: 7 }] : []];
    }

    if (statement.startsWith('insert into users')) {
      const [name, email, password, phone, studentId, departmentId] = parameters;
      const user = {
        id: nextUserId++,
        name,
        email,
        password,
        phone,
        student_id: studentId,
        role: 'student',
        department_id: departmentId,
        created_at: new Date('2026-09-28T00:00:00.000Z'),
        updated_at: new Date('2026-09-28T00:00:00.000Z'),
      };
      records.push(user);
      return [{ insertId: user.id }];
    }

    if (statement.startsWith('select') && statement.includes('from users where id =')) {
      const user = records.find((candidate) => candidate.id === parameters[0]);
      if (!user) return [[]];
      return [[statement.includes('password') ? { ...user } : safeColumns(user)]];
    }

    if (statement.startsWith('select') && statement.includes('from users') && statement.includes('where email =')) {
      const user = records.find((candidate) => candidate.email === parameters[0]);
      return [user ? [{ ...user }] : []];
    }

    throw new Error(`Unexpected query in authentication test: ${statement}`);
  },
};

const originalDb = require('../config/db');
const databaseModulePath = require.resolve('../config/db');
require.cache[databaseModulePath] = {
  id: databaseModulePath,
  filename: databaseModulePath,
  loaded: true,
  exports: fakeDb,
};

const app = require('../app');
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  require.cache[databaseModulePath] = {
    id: databaseModulePath,
    filename: databaseModulePath,
    loaded: true,
    exports: originalDb,
  };
});

const request = async (pathname, options = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  return { response, body };
};

test('registration, login, JWT protection, validation, and role checks', async (t) => {
  await t.test('rejects missing required fields and malformed email', async () => {
    const missing = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Student' }),
    });
    assert.equal(missing.response.status, 400);

    const invalidEmail = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Student', email: 'not-an-email', password: 'long-enough' }),
    });
    assert.equal(invalidEmail.response.status, 400);

    const invalidStudentId = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Student',
        email: 'student@example.edu',
        password: 'long-enough',
        studentId: 42,
      }),
    });
    assert.equal(invalidStudentId.response.status, 400);
    assert.equal(records.length, 0);
  });

  await t.test('persists a hashed password and defaults role to student', async () => {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Student',
        email: '  New.Student@Campus.edu ',
        password: 'student-password',
        phone: '+1-555-0101',
        studentId: 'S-2026-001',
        departmentId: 7,
        role: 'admin',
      }),
    });

    assert.equal(result.response.status, 201);
    assert.equal(result.body.user.email, 'new.student@campus.edu');
    assert.equal(result.body.user.role, 'student');
    assert.equal(result.body.user.student_id, 'S-2026-001');
    assert.equal(Object.hasOwn(result.body.user, 'password'), false);
    assert.equal(records.length, 1);
    assert.notEqual(records[0].password, 'student-password');
    assert.match(records[0].password, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare('student-password', records[0].password), true);
  });

  await t.test('rejects duplicate email and duplicate student ID', async () => {
    const duplicateEmail = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Another Student',
        email: 'NEW.STUDENT@campus.edu',
        password: 'another-password',
      }),
    });
    assert.equal(duplicateEmail.response.status, 409);

    const duplicateStudentId = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Another Student',
        email: 'another.student@campus.edu',
        password: 'another-password',
        studentId: 'S-2026-001',
      }),
    });
    assert.equal(duplicateStudentId.response.status, 409);
    assert.equal(records.length, 1);
  });

  await t.test('rejects missing login fields, invalid email, and wrong password', async () => {
    const missing = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.student@campus.edu' }),
    });
    assert.equal(missing.response.status, 400);

    const invalidEmail = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid', password: 'student-password' }),
    });
    assert.equal(invalidEmail.response.status, 400);

    const wrongPassword = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.student@campus.edu', password: 'incorrect-password' }),
    });
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(wrongPassword.body.message, 'Invalid email or password.');
  });

  await t.test('returns a JWT and serves safe current-user data to its holder', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'NEW.STUDENT@campus.edu', password: 'student-password' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(typeof login.body.token, 'string');
    assert.equal(Object.hasOwn(login.body.user, 'password'), false);
    assert.equal(jwt.verify(login.body.token, process.env.JWT_SECRET).sub, String(records[0].id));

    const currentUser = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(currentUser.response.status, 200);
    assert.equal(currentUser.body.user.email, 'new.student@campus.edu');
    assert.equal(Object.hasOwn(currentUser.body.user, 'password'), false);
  });

  await t.test('rejects absent, malformed, and expired JWTs', async () => {
    const absent = await request('/api/auth/me');
    assert.equal(absent.response.status, 401);

    const malformed = await request('/api/auth/me', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(malformed.response.status, 401);

    const expiredToken = jwt.sign(
      {},
      process.env.JWT_SECRET,
      { algorithm: 'HS256', subject: String(records[0].id), expiresIn: -1 }
    );
    const expired = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expired.response.status, 401);
  });

  await t.test('role authorization denies users without an allowed role', () => {
    const { authorize } = require('../middleware/auth');
    let nextCalled = false;
    let statusCode;
    let responseBody;

    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    authorize('admin')(
      { user: { role: 'student' } },
      response,
      () => { nextCalled = true; }
    );

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(responseBody.message, 'You do not have access to this resource.');

    authorize('student')(
      { user: { role: 'student' } },
      response,
      () => { nextCalled = true; }
    );
    assert.equal(nextCalled, true);
  });
});
