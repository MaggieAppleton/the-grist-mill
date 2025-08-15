const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'grist_mill.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Initialize database tables
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Create content_items table
    const createContentItemsTable = `
      CREATE TABLE IF NOT EXISTS content_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT,
        summary TEXT,
        raw_content TEXT,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_type, source_id)
      )
    `;

    db.run(createContentItemsTable, (err) => {
      if (err) {
        console.error('Error creating content_items table:', err.message);
        reject(err);
      } else {
        console.log('Content items table created or already exists.');
        resolve();
      }
    });
  });
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      resolve();
    });
  });
}

module.exports = {
  db,
  initializeDatabase,
  closeDatabase
};
