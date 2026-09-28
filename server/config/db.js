const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let pool;

const getPool = () => {
  if (pool) {
    return pool;
  }

  const requiredConfig = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingConfig = requiredConfig.filter((key) => process.env[key] === undefined);

  if (missingConfig.length) {
    throw new Error(
      `Missing MySQL configuration: ${missingConfig.join(', ')}. Configure these values in the project root .env file.`
    );
  }

  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    multipleStatements: false,
  });

  return pool;
};

module.exports = {
  execute: (...args) => getPool().execute(...args),
  query: (...args) => getPool().query(...args),
  getConnection: (...args) => getPool().getConnection(...args),
  end: () => (pool ? pool.end() : Promise.resolve()),
};
