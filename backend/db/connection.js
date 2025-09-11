const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file path (relative to backend/)
const DB_PATH = path.join(__dirname, "..", "grist_mill.db");

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		console.error("Error opening database:", err.message);
	} else {
		console.log("Connected to SQLite database.");
	}
});

module.exports = { db, DB_PATH };
