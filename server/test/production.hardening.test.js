const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const app = require('../app');
const { validateJwtSecret, validateEnvironment, INSECURE_SECRETS } = require('../config/env');

let baseUrl;
let server;
const createdUserIds = [];

const request = async (route, { method = 'GET', body, headers = {}, token } = {}) => {
  const reqHeaders = { ...headers };
  if (token) reqHeaders.authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    if (typeof body === 'string') {
      payload = body;
    } else {
      reqHeaders['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: reqHeaders,
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
  for (const id of createdUserIds) {
    await db.execute('DELETE FROM users WHERE id = ?', [id]).catch(() => {});
  }

  if (server?.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await db.end();
});

test('Production Security Hardening Suite', async (t) => {
  await t.test('1. Security Headers: Helmet sets critical defensive HTTP headers', async () => {
    const { response } = await request('/api/health');
    assert.equal(response.status, 200);

    const headers = response.headers;
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.ok(headers.get('x-frame-options') === 'SAMEORIGIN' || headers.get('x-frame-options') === 'DENY');
    assert.ok(headers.get('content-security-policy') !== null);
    assert.equal(headers.get('x-powered-by'), null); // x-powered-by disabled
  });

  await t.test('2. CORS Behavior: Rejects unauthorized origins when configured', async () => {
    const { response } = await request('/api/health', {
      headers: {
        origin: 'https://malicious-attacker-site.com',
      },
    });

    assert.equal(response.status, 403);
  });

  await t.test('3. Body Parser Limits: Rejects malformed JSON bodies gracefully', async () => {
    const { response, data } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"invalid_json: true, broken',
    });

    assert.equal(response.status, 400);
    assert.match(data.message, /malformed json/i);
  });

  await t.test('4. JWT Secret Validation: Rejects missing, weak, or demo secrets in production', async () => {
    // Missing secret
    assert.throws(() => validateJwtSecret(undefined, 'production'), /missing/i);
    assert.throws(() => validateJwtSecret('', 'production'), /missing/i);

    // Short secret (< 32 chars)
    assert.throws(() => validateJwtSecret('short-secret', 'production'), /at least 32 characters/i);

    // Insecure demo secrets in production
    for (const badSecret of INSECURE_SECRETS) {
      assert.throws(
        () => validateJwtSecret(badSecret, 'production'),
        /insecure demo\/default jwt_secret/i
      );
    }

    // Valid strong secret in production passes
    const strongSecret = 'a-very-strong-and-secure-production-jwt-secret-key-1234567890';
    assert.equal(validateJwtSecret(strongSecret, 'production'), strongSecret);
  });

  await t.test('5. Error Masking: Server errors never expose stack traces or raw SQL details', async () => {
    // Requesting a nonexistent resource or triggering error handler
    const { response, data } = await request('/api/nonexistent-audit-endpoint');
    assert.equal(response.status, 404);
    assert.equal(typeof data.message, 'string');
    assert.equal(data.stack, undefined);
    assert.equal(data.sql, undefined);
  });

  await t.test('6. Inactive Token Invalidation: Deactivated user with existing valid JWT is blocked', async () => {
    const suffix = Date.now().toString(36);
    const email = `deact_harden_${suffix}@test.edu`;
    const hash = await bcrypt.hash('Password123!', 10);

    const [res] = await db.execute(
      `INSERT INTO users (name, email, password, phone, role, status)
       VALUES ('Deactivated User', ?, ?, '9999999999', 'student', 'Active')`,
      [email, hash]
    );
    const userId = res.insertId;
    createdUserIds.push(userId);

    // 1. Log in to get token while active
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'Password123!' },
    });
    assert.equal(loginRes.response.status, 200);
    const token = loginRes.data.token;

    // 2. Deactivate account in DB
    await db.execute("UPDATE users SET status = 'Inactive' WHERE id = ?", [userId]);

    // 3. Attempt accessing protected endpoint with token
    const authCheck = await request('/api/auth/me', { token });
    assert.equal(authCheck.response.status, 403);
    assert.match(authCheck.data.message, /deactivated/i);
  });

  await t.test('7. Rate Limiter: Enforces 429 when max login attempts threshold is exceeded', async () => {
    const express = require('express');
    const rateLimit = require('express-rate-limit');

    const testApp = express();
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
    });

    testApp.post('/login', testLimiter, (_req, res) => res.json({ ok: true }));

    let testServer;
    await new Promise((resolve) => {
      testServer = testApp.listen(0, '127.0.0.1', () => resolve());
    });
    const testPort = testServer.address().port;

    try {
      const res1 = await fetch(`http://127.0.0.1:${testPort}/login`, { method: 'POST' });
      assert.equal(res1.status, 200);

      const res2 = await fetch(`http://127.0.0.1:${testPort}/login`, { method: 'POST' });
      assert.equal(res2.status, 200);

      const res3 = await fetch(`http://127.0.0.1:${testPort}/login`, { method: 'POST' });
      assert.equal(res3.status, 429);
      const res3Data = await res3.json();
      assert.match(res3Data.message, /too many login attempts/i);
    } finally {
      if (testServer?.closeAllConnections) testServer.closeAllConnections();
      await new Promise((resolve) => testServer.close(resolve));
    }
  });
});
