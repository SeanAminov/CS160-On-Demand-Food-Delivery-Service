const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_delivery_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  multipleStatements: true,
};

const pool = mysql.createPool(config);

async function initializeDatabase() {
  const schemaSql = fs.readFileSync(
    path.join(__dirname, 'data', 'schema.sql'),
    'utf8'
  );

  const adminConnection = await mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
    multipleStatements: true,
  });

  try {
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    await adminConnection.query(`USE \`${config.database}\``);
    await adminConnection.query(schemaSql);
    console.log(`Database initialized: ${config.database}`);
  } finally {
    await adminConnection.end();
  }
}

module.exports = pool;
module.exports.initializeDatabase = initializeDatabase;