const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const session = require('express-session');
const http = require('http');
const pool = require('../db');
const authRoutes = require('../routes/users');


describe('Auth & profile routes', () => {
  let server;
  let baseUrl;

  const stamp = Date.now();
  const email = `auth_test_${stamp}@example.com`;
  const name = 'Auth Tester';
  const password = 'auth_tester_password_1';

  const post = (path, body, cookie) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) },
      body: JSON.stringify(body ?? {})
    });

  const get = (path, cookie) =>
    fetch(`${baseUrl}${path}`, { headers: cookie ? { cookie } : {} });

  const cookieFrom = (res) => res.headers.get('set-cookie').split(';')[0];

  const validRegistration = (overrides = {}) => ({
    name,
    email,
    password,
    confirmPassword: password,
    ...overrides
  });
  // Setup Before Tests
  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'auth-test-secret', resave: false, saveUninitialized: false }));
    app.use('/', authRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  // Cleanup after tests
  after(async () => {
    await pool.query(`DELETE FROM Users WHERE email LIKE 'auth_test_%@example.com'`);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  // Tests the Registration Process
  describe('POST /register', () => {
    test('Error if there are any missing fields', async () => {
      const res = await post('/register', { email });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Invalid input.');
    });

    test('Error if name is over 100 characters long', async () => {
      const res = await post('/register', validRegistration({ name: 'a'.repeat(101) }));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Name must be 100 characters or less.');
    });

    test('Error if password does not match with confirm password', async () => {
      const res = await post('/register', validRegistration({ confirmPassword: 'not-matching-password' }));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Passwords do not match.');
    });

    test('Error if password is less than 8 characters', async () => {
      const res = await post('/register', validRegistration({ password: 'short', confirmPassword: 'short' }));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Password must be at least 8 characters.');
    });

    test('Error if password is over 72 characters long', async () => {
      const long = 'a'.repeat(73);
      const res = await post('/register', validRegistration({ password: long, confirmPassword: long }));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Password must be 72 characters or less.');
    });

    test('Error if email does not match email format', async () => {
      const res = await post('/register', validRegistration({ email: 'not-an-email' }));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Invalid email format.');
    });

    test('Tests account creation and password hashing', async () => {
      const res = await post('/register', validRegistration({ email: `  ${email.toUpperCase()}  ` }));
      assert.strictEqual(res.status, 201);
      assert.strictEqual((await res.json()).message, 'Account created.');

      const [rows] = await pool.query('SELECT name, password_hash FROM Users WHERE email = ?', [email]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].name, name);
      assert.notStrictEqual(rows[0].password_hash, password);
      assert.ok(rows[0].password_hash.length > 20);
    });

    test('Error if email is already registered', async () => {
      const res = await post('/register', validRegistration());
      assert.strictEqual(res.status, 409);
      assert.strictEqual((await res.json()).error, 'Email already in use.');
    });
  });

  // Tests the Login Process
  describe('POST /login, GET /profile, POST /logout', () => {
    test('Error if login without password', async () => {
      const res = await post('/login', { email });
      assert.strictEqual(res.status, 400);
    });

    test('Tests incorrect password handling', async () => {
      const res = await post('/login', { email, password: 'incorrect-password' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual((await res.json()).error, 'Incorrect email or password');
    });

    test('Tests incorrect unregistered email login', async () => {
      const res = await post('/login', { email: `unregistered_${stamp}@example.com`, password });
      assert.strictEqual(res.status, 401);
      assert.strictEqual((await res.json()).error, 'Incorrect email or password');
    });

    test('Tests authorization without logging in', async () => {
      const res = await get('/profile');
      assert.strictEqual(res.status, 401);
    });

    test('Tests session cookies', async () => {
      const loginRes = await post('/login', { email, password });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      assert.ok(loginData.user_id);
      assert.ok(loginData.role);
      const cookie = cookieFrom(loginRes);

      const profileRes = await get('/profile', cookie);
      assert.strictEqual(profileRes.status, 200);
      const profile = await profileRes.json();
      assert.strictEqual(profile.userID, loginData.user_id);
      assert.strictEqual(profile.name, name);

      const logoutRes = await post('/logout', {}, cookie);
      assert.strictEqual(logoutRes.status, 200);
      assert.strictEqual((await logoutRes.json()).message, 'Logged Out');

      const after = await get('/profile', cookie);
      assert.strictEqual(after.status, 401);
    });

    test('Tests unnormalized email login', async () => {
      const res = await post('/login', { email: `  ${email.toUpperCase()} `, password });
      assert.strictEqual(res.status, 200);
    });
  });

  // Tests Forgot Password process
  describe('POST /forgot-password', () => {
    const newPassword = 'auth_tester_password_2';

    test('Tests password reset without email', async () => {
      const res = await post('/forgot-password/code', {});
      assert.strictEqual(res.status, 400);
    });

    test('Tests getting a password reset code for an unregistered email', async () => {
      const res = await post('/forgot-password/code', { email: `unregistered_${stamp}@example.com` });
      assert.strictEqual(res.status, 404);
    });

    test('Error if all fields for password reset are not filled in', async () => {
      const res = await post('/forgot-password/reset', { email });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Fill in all fields.');
    });

    test('Error if you try to reset with the wrong code', async () => {
      const codeRes = await post('/forgot-password/code', { email });
      const { code } = await codeRes.json();

      const bad = await post('/forgot-password/reset', { email, code: '000000x', password: newPassword });
      assert.strictEqual(bad.status, 400);
      assert.strictEqual((await bad.json()).error, 'Incorrect Code');

      const retry = await post('/forgot-password/reset', { email, code, password: newPassword });
      assert.strictEqual(retry.status, 400);
    });

    test('Tests if password reset works', async () => {
      const codeRes = await post('/forgot-password/code', { email });
      assert.strictEqual(codeRes.status, 200);
      const { code } = await codeRes.json();
      assert.match(code, /^\d{6}$/);

      const res = await post('/forgot-password/reset', { email, code, password: newPassword });
      assert.strictEqual(res.status, 200);

      const oldLogin = await post('/login', { email, password });
      assert.strictEqual(oldLogin.status, 401);

      const newLogin = await post('/login', { email, password: newPassword });
      assert.strictEqual(newLogin.status, 200);
    });
  });

  // Tests Authentication for address if not logged in
  describe('/profile/address', () => {
    test('Tests access for address if not logged in', async () => {
      const res = await get('/profile/address');
      assert.strictEqual(res.status, 401);
    });

    test('Tests if there is no address for new users', async () => {
      const loginRes = await post('/login', { email, password: 'auth_tester_password_2'});
      const cookie = cookieFrom(loginRes);

      const res = await get('/profile/address', cookie);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.address, null);
      assert.ok('parts' in data);
    });
  });
});