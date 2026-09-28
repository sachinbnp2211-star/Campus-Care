const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { getJwtSecret } = require('../middleware/auth');

const safeUserColumns = `id, name, email, phone, student_id, role, department_id, status, created_at, updated_at`;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isValidEmail = (email) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateRegistration = (body) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
    return { error: 'Phone must be a string.' };
  }
  if (body.studentId !== undefined && body.studentId !== null && typeof body.studentId !== 'string') {
    return { error: 'Student ID must be a string.' };
  }
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
  const departmentId = body.departmentId;

  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.' };
  }
  if (name.length > 100) {
    return { error: 'Name must be 100 characters or fewer.' };
  }
  if (!isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: 'Password must be between 8 and 72 characters.' };
  }
  if (phone.length > 30) {
    return { error: 'Phone must be 30 characters or fewer.' };
  }
  if (studentId.length > 50) {
    return { error: 'Student ID must be 50 characters or fewer.' };
  }

  let parsedDepartmentId = null;
  if (departmentId !== undefined && departmentId !== null && departmentId !== '') {
    parsedDepartmentId = Number(departmentId);
    if (!Number.isSafeInteger(parsedDepartmentId) || parsedDepartmentId < 1) {
      return { error: 'Department ID must be a positive integer.' };
    }
  }

  return {
    value: {
      name,
      email,
      password,
      phone: phone || null,
      studentId: studentId || null,
      departmentId: parsedDepartmentId,
    },
  };
};

const validateLogin = (body) => {
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }
  if (!isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }
  if (password.length > 72) {
    return { error: 'Invalid email or password.' };
  }

  return { value: { email, password } };
};

const createToken = (user) =>
  jwt.sign(
    {},
    getJwtSecret(),
    {
      algorithm: 'HS256',
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    }
  );

const register = async (req, res, next) => {
  const validation = validateRegistration(req.body || {});
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const { name, email, password, phone, studentId, departmentId } = validation.value;

  try {
    const [existingEmail] = await db.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (existingEmail.length) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    if (studentId) {
      const [existingStudentId] = await db.execute(
        'SELECT id FROM users WHERE student_id = ? LIMIT 1',
        [studentId]
      );
      if (existingStudentId.length) {
        return res.status(409).json({ message: 'Student ID is already registered.' });
      }
    }

    if (departmentId !== null) {
      const [departments] = await db.execute(
        'SELECT id FROM departments WHERE id = ? LIMIT 1',
        [departmentId]
      );
      if (!departments.length) {
        return res.status(400).json({ message: 'Department was not found.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, phone, student_id, role, department_id, status)
       VALUES (?, ?, ?, ?, ?, 'student', ?, 'Active')`,
      [name, email, passwordHash, phone, studentId, departmentId]
    );

    const [users] = await db.execute(
      `SELECT ${safeUserColumns} FROM users WHERE id = ?`,
      [result.insertId]
    );

    if (!users.length) {
      throw new Error('User insert succeeded but the created user could not be loaded.');
    }

    return res.status(201).json({ user: users[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const duplicateStudentId = error.message.includes('student_id');
      return res.status(409).json({
        message: duplicateStudentId ? 'Student ID is already registered.' : 'Email is already registered.',
      });
    }
    return next(error);
  }
};

const login = async (req, res, next) => {
  const validation = validateLogin(req.body || {});
  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  const { email, password } = validation.value;

  try {
    const [users] = await db.execute(
      `SELECT id, name, email, password, phone, student_id, role, department_id, status, created_at, updated_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (users[0].status === 'Inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact an administrator.' });
    }

    const { password: _passwordHash, ...user } = users[0];
    const token = createToken(user);
    return res.json({ token, user });
  } catch (error) {
    return next(error);
  }
};

const me = (req, res) => res.json({ user: req.user });

module.exports = { register, login, me };
