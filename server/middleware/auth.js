const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateJwtSecret } = require('../config/env');

const getJwtSecret = () => validateJwtSecret(process.env.JWT_SECRET);

const protect = async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  let claims;
  try {
    claims = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    return next(error);
  }

  const userId = Number(claims.sub);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, name, email, phone, student_id, role, department_id, status, created_at, updated_at
       FROM users
       WHERE id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Authenticated user no longer exists.' });
    }

    if (rows[0].status === 'Inactive') {
      return res.status(403).json({ message: 'Account is deactivated. Please contact an administrator.' });
    }

    req.user = rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have access to this resource.' });
  }

  return next();
};

module.exports = { protect, authorize, getJwtSecret };
