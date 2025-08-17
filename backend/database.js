const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file path
const DB_PATH = path.join(__dirname, "grist_mill.db");

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		console.error("Error opening database:", err.message);
	} else {
		console.log("Connected to SQLite database.");
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
				console.error("Error creating content_items table:", err.message);
				reject(err);
			} else {
				console.log("Content items table created or already exists.");
				resolve();
			}
		});
	});
}

// Insert sample data
function insertSampleData() {
	return new Promise((resolve, reject) => {
		const sampleItem = {
			source_type: "discord",
			source_id: "sample_001",
			title: "Sample Discord Activity",
			summary:
				"This is a sample content item from Discord showing 3 messages about web development and project updates.",
			raw_content: JSON.stringify({
				server_name: "Dev Community",
				channels: ["general", "projects"],
				message_count: 3,
				messages: [
					{
						channel: "general",
						content: "Anyone working with React 18 hooks?",
						author: "developer1",
					},
					{
						channel: "projects",
						content: "Just deployed my portfolio site!",
						author: "designer2",
					},
					{
						channel: "general",
						content: "Great tutorial on async/await patterns",
						author: "coder3",
					},
				],
			}),
			url: null,
		};

		const insertQuery = `
      INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

		db.run(
			insertQuery,
			[
				sampleItem.source_type,
				sampleItem.source_id,
				sampleItem.title,
				sampleItem.summary,
				sampleItem.raw_content,
				sampleItem.url,
			],
			function (err) {
				if (err) {
					console.error("Error inserting sample data:", err.message);
					reject(err);
				} else {
					console.log("Sample data inserted with ID:", this.lastID);
					resolve(this.lastID);
				}
			}
		);
	});
}

// Get all content items
function getAllItems() {
	return new Promise((resolve, reject) => {
		const query = `
      SELECT id, source_type, source_id, title, summary, raw_content, url, created_at, collected_at
      FROM content_items 
      ORDER BY created_at DESC
    `;

		db.all(query, [], (err, rows) => {
			if (err) {
				console.error("Error fetching items:", err.message);
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
}

// Insert a single content item (ignores duplicates by UNIQUE constraint)
function insertContentItem(item) {
	return new Promise((resolve, reject) => {
		const insertQuery = `
      INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
		db.run(
			insertQuery,
			[
				item.source_type,
				item.source_id,
				item.title || null,
				item.summary || null,
				item.raw_content || null,
				item.url || null,
			],
			function (err) {
				if (err) {
					return reject(err);
				}
				resolve(this.lastID);
			}
		);
	});
}

// Bulk insert content items in a transaction
function insertContentItems(items) {
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run("BEGIN TRANSACTION");
			const stmt = db.prepare(
				"INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url) VALUES (?, ?, ?, ?, ?, ?)"
			);
			let insertedCount = 0;
			for (const item of items) {
				stmt.run(
					[
						item.source_type,
						item.source_id,
						item.title || null,
						item.summary || null,
						item.raw_content || null,
						item.url || null,
					],
					function (err) {
						if (!err && this.changes > 0) {
							insertedCount += 1;
						}
					}
				);
			}
			stmt.finalize((err) => {
				if (err) {
					db.run("ROLLBACK");
					return reject(err);
				}
				db.run("COMMIT", (commitErr) => {
					if (commitErr) return reject(commitErr);
					resolve(insertedCount);
				});
			});
		});
	});
}

// Close database connection
function closeDatabase() {
	return new Promise((resolve) => {
		db.close((err) => {
			if (err) {
				console.error("Error closing database:", err.message);
			} else {
				console.log("Database connection closed.");
			}
			resolve();
		});
	});
}

module.exports = {
	db,
	initializeDatabase,
	insertSampleData,
	getAllItems,
	insertContentItem,
	insertContentItems,
	closeDatabase,
};
