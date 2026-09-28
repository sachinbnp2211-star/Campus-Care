async function checkDatabaseConnection() {
  let db;
  let connection;

  try {
    db = require('../config/db');
    connection = await db.getConnection();
    const [rows] = await connection.query(
      'SELECT DATABASE() AS database_name, VERSION() AS server_version'
    );

    console.log(
      `Connected to MySQL ${rows[0].server_version} database "${rows[0].database_name}".`
    );
  } catch (error) {
    console.error(`MySQL connection check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (connection) {
      connection.release();
    }
    if (db) await db.end();
  }
}

checkDatabaseConnection();
