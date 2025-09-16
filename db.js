// import environment variables from .env file
require('dotenv').config();

const mysql = require("mysql2");

// 配置 MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL connected");
});

module.exports = db;
