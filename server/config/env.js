const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const INSECURE_SECRETS = new Set([
  'replace_with_a_random_secret_at_least_32_characters',
  'your-default-jwt-secret-change-in-production',
  'phase-three-test-secret-with-more-than-32-characters',
  'secret',
  'password',
  '12345678901234567890123456789012',
]);

const validateJwtSecret = (secret, nodeEnv = process.env.NODE_ENV) => {
  if (!secret || typeof secret !== 'string') {
    throw new Error('JWT_SECRET environment variable is missing.');
  }

  if (nodeEnv === 'production') {
    const normalized = secret.trim().toLowerCase();
    if (INSECURE_SECRETS.has(normalized)) {
      throw new Error(
        'Insecure demo/default JWT_SECRET cannot be used in production. Set a cryptographically random secret of at least 32 characters.'
      );
    }
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  }

  return secret;
};

const validateEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  // 1. Required Database Variables
  const requiredDbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingDbVars = requiredDbVars.filter((key) => process.env[key] === undefined);

  if (missingDbVars.length > 0) {
    throw new Error(
      `Missing database configuration: ${missingDbVars.join(', ')}. Configure these variables in your environment or .env file.`
    );
  }

  const dbPort = Number(process.env.DB_PORT);
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  // 2. JWT Secret Validation
  validateJwtSecret(process.env.JWT_SECRET, nodeEnv);

  // 3. Production-specific checks
  if (isProd) {
    const clientUrl = process.env.CLIENT_URL || '';
    if (!clientUrl || clientUrl === '*') {
      throw new Error(
        'CLIENT_URL must be explicitly configured with trusted origin(s) in production (cannot be empty or "*").'
      );
    }
  }

  return {
    nodeEnv,
    port: Number(process.env.PORT) || 5000,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  };
};

module.exports = {
  validateJwtSecret,
  validateEnvironment,
  INSECURE_SECRETS,
};
