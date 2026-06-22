const Database = require('better-sqlite3');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'gems.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
function initializeDatabase() {
  // Drop existing tables for fresh setup (development only)
  // db.exec('DROP TABLE IF EXISTS applications');
  // db.exec('DROP TABLE IF EXISTS students');
  // db.exec('DROP TABLE IF EXISTS opportunities');

  // Create opportunities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      institution TEXT NOT NULL,
      country TEXT NOT NULL,
      type TEXT NOT NULL,
      deadline TEXT NOT NULL,
      capacity INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create students table
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      college TEXT NOT NULL,
      cgpa REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create applications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      opportunity_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      submitted_date TEXT NOT NULL,
      documents_status TEXT NOT NULL DEFAULT 'incomplete',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    )
  `);

  console.log('✓ Database schema initialized');
}

module.exports = {
  db,
  initializeDatabase
};
