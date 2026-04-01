import mysql from 'mysql2/promise';

const {
  MYSQL_HOST = '127.0.0.1',
  MYSQL_PORT = '3306',
  MYSQL_USER = 'root',
  MYSQL_PASSWORD = '',
  MYSQL_DATABASE = 'tarot_online'
} = process.env;

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_questions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      request_id VARCHAR(100) NOT NULL,
      name VARCHAR(120) NULL,
      question TEXT NOT NULL,
      drawn_card VARCHAR(120) NULL,
      client_ip VARCHAR(64) NULL,
      client_address VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_stats (
      client_key VARCHAR(255) PRIMARY KEY,
      client_ip VARCHAR(64) NOT NULL,
      client_address VARCHAR(255) NULL,
      question_count INT NOT NULL DEFAULT 0,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_question_count (question_count)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function trackQuestion({ requestId, name, question, drawnCard, clientIp, clientAddress }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO user_questions (request_id, name, question, drawn_card, client_ip, client_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, name || null, question, drawnCard || null, clientIp || null, clientAddress || null]
    );

    const clientKey = clientIp || clientAddress || 'unknown';

    await conn.query(
      `INSERT INTO client_stats (client_key, client_ip, client_address, question_count, last_seen_at)
       VALUES (?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         question_count = question_count + 1,
         client_address = VALUES(client_address),
         last_seen_at = NOW()`,
      [clientKey, clientIp || 'unknown', clientAddress || null]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function getTopClients(limit = 20) {
  const [rows] = await pool.query(
    `SELECT client_ip, client_address, question_count, last_seen_at
     FROM client_stats
     ORDER BY question_count DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}

export async function getLatestQuestions(limit = 50) {
  const [rows] = await pool.query(
    `SELECT request_id, name, question, drawn_card, client_ip, client_address, created_at
     FROM user_questions
     ORDER BY id DESC
     LIMIT ?`,
    [limit]
  );
  return rows;
}
