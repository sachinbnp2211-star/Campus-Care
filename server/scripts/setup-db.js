const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../');

function splitSqlStatements(sql) {
  const statements = [];
  let statementStart = 0;
  let quote = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];

    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        if (sql[index + 1] === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === ';') {
      const statement = sql.slice(statementStart, index).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
    }
  }

  const finalStatement = sql.slice(statementStart).trim();
  if (finalStatement) statements.push(finalStatement);

  if (quote) {
    throw new Error('SQL file contains an unterminated quoted value.');
  }

  return statements;
}

async function readSqlStatements(filename) {
  const sql = await fs.readFile(path.join(projectRoot, 'database', filename), 'utf8');
  return splitSqlStatements(sql);
}

async function executeStatements(connection, statements) {
  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function setupDatabase() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_DB_SETUP !== 'true') {
    console.error(
      'ABORTED: db:setup was invoked in production mode without ALLOW_PROD_DB_SETUP=true. Refusing to run seed scripts against production database.'
    );
    process.exit(1);
  }

  let db;
  let connection;

  try {
    const schemaStatements = await readSqlStatements('schema.sql');
    const seedStatements = await readSqlStatements('seed.sql');
    console.log(
      `Prepared ${schemaStatements.length} schema statements and ${seedStatements.length} seed statements.`
    );

    db = require('../config/db');
    connection = await db.getConnection();
    await executeStatements(connection, schemaStatements);
    console.log(`Applied ${schemaStatements.length} schema statements.`);

    const [studentIdColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'student_id'`
    );
    if (!studentIdColumn.length) {
      await connection.query(
        'ALTER TABLE users ADD COLUMN student_id VARCHAR(50) NULL AFTER phone'
      );
      console.log('Added users.student_id to an existing Phase 2 database.');
    }

    const [studentIdIndex] = await connection.query(
      `SELECT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND INDEX_NAME = 'uq_users_student_id'`
    );
    if (!studentIdIndex.length) {
      await connection.query(
        'ALTER TABLE users ADD UNIQUE KEY uq_users_student_id (student_id)'
      );
      console.log('Added the unique student ID index.');
    }

    const [statusColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'status'`
    );
    if (!statusColumn.length) {
      await connection.query(
        "ALTER TABLE users ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER department_id"
      );
      console.log('Added users.status to database.');
    }

    const [catDeptColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'categories'
         AND COLUMN_NAME = 'department_id'`
    );
    if (!catDeptColumn.length) {
      await connection.query(
        `ALTER TABLE categories
         ADD COLUMN department_id INT UNSIGNED NULL AFTER description,
         ADD CONSTRAINT fk_categories_department
           FOREIGN KEY (department_id) REFERENCES departments(id)
           ON UPDATE CASCADE ON DELETE SET NULL,
         ADD KEY idx_categories_department (department_id)`
      );
      console.log('Added categories.department_id to database.');
    }

    const [catActiveColumn] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'categories'
         AND COLUMN_NAME = 'is_active'`
    );
    if (!catActiveColumn.length) {
      await connection.query(
        'ALTER TABLE categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER department_id'
      );
      console.log('Added categories.is_active to database.');
    }

    await connection.beginTransaction();
    try {
      await executeStatements(connection, seedStatements);
      await connection.commit();
      console.log(`Applied ${seedStatements.length} seed statements.`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const [rows] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM departments) AS departments,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM complaints) AS complaints,
        (SELECT COUNT(*) FROM complaint_attachments) AS attachments,
        (SELECT COUNT(*) FROM complaint_status_history) AS status_history,
        (SELECT COUNT(*) FROM feedback) AS feedback,
        (SELECT COUNT(*) FROM notifications) AS notifications`
    );
    console.log('Database seed verification:', rows[0]);
  } catch (error) {
    console.error(`Database setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (connection) connection.release();
    if (db) await db.end();
  }
}

setupDatabase();
