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
		// Create content_items and ai_usage tables
		const createContentItemsTable = `
      CREATE TABLE IF NOT EXISTS content_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT,
        summary TEXT,
        raw_content TEXT,
        url TEXT,
        highlight BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_type, source_id)
      )
    `;

		const createAIUsageTable = `
      CREATE TABLE IF NOT EXISTS ai_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0,
        requests_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

		const createAIUsageDateIndex = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date)
    `;

		db.serialize(() => {
			db.run(createContentItemsTable, (err) => {
				if (err) {
					console.error("Error creating content_items table:", err.message);
					return reject(err);
				}
				console.log("Content items table created or already exists.");
			});

			db.run(createAIUsageTable, (err) => {
				if (err) {
					console.error("Error creating ai_usage table:", err.message);
					return reject(err);
				}
				console.log("AI usage table created or already exists.");
			});

			db.run(createAIUsageDateIndex, (err) => {
				if (err) {
					console.error("Error creating ai_usage date index:", err.message);
					return reject(err);
				}
				console.log("AI usage date index created or already exists.");
				resolve();
			});
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
      SELECT id, source_type, source_id, title, summary, raw_content, url, highlight, created_at, collected_at
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

// Get items with optional filtering and pagination
function getItemsFiltered({ source, limit = 50, offset = 0 } = {}) {
	return new Promise((resolve, reject) => {
		const whereClauses = [];
		const params = [];
		if (source) {
			whereClauses.push("source_type = ?");
			params.push(source);
		}
		const whereSQL = whereClauses.length
			? `WHERE ${whereClauses.join(" AND ")}`
			: "";
		const query = `
      SELECT id, source_type, source_id, title, summary, raw_content, url, highlight, created_at, collected_at
      FROM content_items
      ${whereSQL}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
		params.push(Number(limit) || 50, Number(offset) || 0);

		db.all(query, params, (err, rows) => {
			if (err) {
				console.error("Error fetching filtered items:", err.message);
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
      INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url, highlight)
      VALUES (?, ?, ?, ?, ?, ?, ?)
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
				item.highlight || false,
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
				"INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url, highlight) VALUES (?, ?, ?, ?, ?, ?, ?)"
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
						item.highlight || false,
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

// Get AI usage totals for a specific date (YYYY-MM-DD)
function getAiUsageForDate(dateStr) {
	return new Promise((resolve, reject) => {
		const query = `
      SELECT tokens_used, estimated_cost, requests_count
      FROM ai_usage
      WHERE date = ?
    `;
		db.get(query, [dateStr], (err, row) => {
			if (err) {
				console.error("Error fetching ai_usage for date:", err.message);
				return reject(err);
			}
			if (!row) {
				return resolve({
					tokens_used: 0,
					estimated_cost: 0,
					requests_count: 0,
				});
			}
			resolve(row);
		});
	});
}

// Get today's AI usage totals
function getTodayAiUsage() {
	const today = new Date().toISOString().slice(0, 10);
	return getAiUsageForDate(today);
}

// Increment AI usage counters for today by the provided amounts
function incrementAiUsage({
	tokensUsed = 0,
	estimatedCost = 0,
	requestsCount = 1,
} = {}) {
	return new Promise((resolve, reject) => {
		const today = new Date().toISOString().slice(0, 10);
		const upsert = `
      INSERT INTO ai_usage (date, tokens_used, estimated_cost, requests_count)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        tokens_used = tokens_used + excluded.tokens_used,
        estimated_cost = estimated_cost + excluded.estimated_cost,
        requests_count = requests_count + excluded.requests_count
    `;
		db.run(
			upsert,
			[
				today,
				Math.max(0, Math.floor(tokensUsed)),
				Math.max(0, Number(estimatedCost) || 0),
				Math.max(0, Math.floor(requestsCount)),
			],
			function (err) {
				if (err) {
					console.error("Error incrementing ai_usage:", err.message);
					return reject(err);
				}
				resolve(this.changes);
			}
		);
	});
}

module.exports = {
	db,
	initializeDatabase,
	insertSampleData,
	getAllItems,
	getItemsFiltered,
	insertContentItem,
	insertContentItems,
	closeDatabase,
	getAiUsageForDate,
	getTodayAiUsage,
	incrementAiUsage,
};
