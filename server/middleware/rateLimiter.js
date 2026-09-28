const rateLimit = require('express-rate-limit');

const isTestEnv = process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTestEnv && process.env.TEST_RATE_LIMIT === 'true'
    ? 3
    : Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  skip: () => isTestEnv && process.env.TEST_RATE_LIMIT !== 'true',
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.API_RATE_LIMIT_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP. Please try again later.',
  },
  skip: () => isTestEnv && process.env.TEST_RATE_LIMIT !== 'true',
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
