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
        page_text TEXT,
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

		const createResearchStatementsTable = `
      CREATE TABLE IF NOT EXISTS research_statements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        statement TEXT NOT NULL,
        embedding BLOB,
        keywords TEXT,
        negative_keywords TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

		db.serialize(() => {
			function proceedAfterContentItems() {
				db.run(createAIUsageTable, (err) => {
					if (err) {
						console.error("Error creating ai_usage table:", err.message);
						return reject(err);
					}
					console.log("AI usage table created or already exists.");

					db.run(createAIUsageDateIndex, (idxErr) => {
						if (idxErr) {
							console.error(
								"Error creating ai_usage date index:",
								idxErr.message
							);
							return reject(idxErr);
						}
						console.log("AI usage date index created or already exists.");

						// Create research_statements table and seed default if empty
						db.run(createResearchStatementsTable, (rsErr) => {
							if (rsErr) {
								console.error(
									"Error creating research_statements table:",
									rsErr.message
								);
								return reject(rsErr);
							}
							console.log(
								"research_statements table created or already exists."
							);

							// Check schema for keywords columns and seed default topic
							db.all(
								"PRAGMA table_info(research_statements)",
								[],
								(infoErr, cols) => {
									if (infoErr) {
										console.error(
											"Error reading research_statements schema:",
											infoErr.message
										);
										return reject(infoErr);
									}
									const existing = new Set((cols || []).map((r) => r.name));
									const required = [
										"id",
										"name",
										"statement",
										"embedding",
										"keywords",
										"negative_keywords",
										"is_active",
										"created_at",
										"updated_at",
									];
									const missing = required.filter((c) => !existing.has(c));

									const seed = () => {
										db.get(
											"SELECT COUNT(*) as count FROM research_statements",
											[],
											(countErr, row) => {
												if (countErr) {
													console.error(
														"Error counting research_statements:",
														countErr.message
													);
													return reject(countErr);
												}
												if (!row || Number(row.count) === 0) {
													const insertDefault = `
													INSERT INTO research_statements (name, statement, keywords, negative_keywords, is_active)
													VALUES (?, ?, ?, ?, 1)
												`;
													const defaultName = "AI/LLM Research";
													const defaultStatement =
														"Focus on AI/LLM, developer tools, code generation, RAG/embeddings, agent systems, and practical applications improving software development workflows.";
													db.run(
														insertDefault,
														[
															defaultName,
															defaultStatement,
															JSON.stringify([]),
															JSON.stringify([]),
														],
														(insErr) => {
															if (insErr) {
																console.error(
																	"Error inserting default research statement:",
																	insErr.message
																);
																return reject(insErr);
															}
															console.log(
																"Inserted default research statement."
															);
															return resolve();
														}
													);
												} else {
													return resolve();
												}
											}
										);
									};

									if (missing.length === 0) {
										return seed();
									}
									console.warn(
										`Resetting 'research_statements' table to ensure required columns: ${missing.join(
											", "
										)}`
									);
									db.run(
										"DROP TABLE IF EXISTS research_statements",
										(dropErr) => {
											if (dropErr) {
												console.error(
													"Error dropping research_statements:",
													dropErr.message
												);
												return reject(dropErr);
											}
											db.run(createResearchStatementsTable, (reErr) => {
												if (reErr) {
													console.error(
														"Error recreating research_statements table:",
														reErr.message
													);
													return reject(reErr);
												}
												console.log(
													"research_statements table reset with correct schema."
												);
												seed();
											});
										}
									);
								}
							);
						});
					});
				});
			}

			db.run(createContentItemsTable, (err) => {
				if (err) {
					console.error("Error creating content_items table:", err.message);
					return reject(err);
				}
				console.log("Content items table created or already exists.");

				// Ensure required columns exist; if not, drop and recreate table
				db.all("PRAGMA table_info(content_items)", [], (infoErr, rows) => {
					if (infoErr) {
						console.error(
							"Error reading content_items schema:",
							infoErr.message
						);
						return reject(infoErr);
					}
					const existing = new Set((rows || []).map((r) => r.name));
					const required = [
						"id",
						"source_type",
						"source_id",
						"title",
						"summary",
						"page_text",
						"raw_content",
						"url",
						"highlight",
						"created_at",
						"collected_at",
					];
					const missing = required.filter((c) => !existing.has(c));
					if (missing.length === 0) {
						return proceedAfterContentItems();
					}
					console.warn(
						`Resetting 'content_items' table to ensure required columns: ${missing.join(
							", "
						)}`
					);
					db.run("DROP TABLE IF EXISTS content_items", (dropErr) => {
						if (dropErr) {
							console.error("Error dropping content_items:", dropErr.message);
							return reject(dropErr);
						}
						db.run(createContentItemsTable, (recreateErr) => {
							if (recreateErr) {
								console.error(
									"Error recreating content_items table:",
									recreateErr.message
								);
								return reject(recreateErr);
							}
							console.log("content_items table reset with correct schema.");
							proceedAfterContentItems();
						});
					});
				});
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
      SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, created_at, collected_at
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
      SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, created_at, collected_at
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

// Search items by query string across title, summary, and raw content
function searchItems({ query, source, limit = 50, offset = 0 } = {}) {
	return new Promise((resolve, reject) => {
		if (!query || typeof query !== "string" || query.trim().length === 0) {
			// If no search query, fall back to regular filtered results
			return getItemsFiltered({ source, limit, offset })
				.then(resolve)
				.catch(reject);
		}

		const whereClauses = [];
		const params = [];

		// Add search conditions
		const searchTerm = `%${query.trim()}%`;
		whereClauses.push(
			"(title LIKE ? OR summary LIKE ? OR raw_content LIKE ? OR page_text LIKE ?)"
		);
		params.push(searchTerm, searchTerm, searchTerm, searchTerm);

		// Add source filter if provided
		if (source) {
			whereClauses.push("source_type = ?");
			params.push(source);
		}

		const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;
		const searchQuery = `
			SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, created_at, collected_at
			FROM content_items
			${whereSQL}
			ORDER BY 
				CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
				created_at DESC
			LIMIT ? OFFSET ?
		`;

		// Add search term again for ORDER BY ranking
		params.push(searchTerm, Number(limit) || 50, Number(offset) || 0);

		db.all(searchQuery, params, (err, rows) => {
			if (err) {
				console.error("Error searching items:", err.message);
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
      INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, page_text, raw_content, url, highlight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
		db.run(
			insertQuery,
			[
				item.source_type,
				item.source_id,
				item.title || null,
				item.summary || null,
				item.page_text || null,
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
				"INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, page_text, raw_content, url, highlight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
			);
			let insertedCount = 0;
			for (const item of items) {
				stmt.run(
					[
						item.source_type,
						item.source_id,
						item.title || null,
						item.summary || null,
						item.page_text || null,
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

// Research statements helpers
function getAllResearchStatements() {
	return new Promise((resolve, reject) => {
		const query = `
			SELECT id, name, statement, embedding, keywords, negative_keywords, is_active, created_at, updated_at
			FROM research_statements
			ORDER BY created_at DESC
		`;
		db.all(query, [], (err, rows) => {
			if (err) {
				return reject(err);
			}
			resolve(rows || []);
		});
	});
}

function getResearchStatementById(id) {
	return new Promise((resolve, reject) => {
		const query = `
			SELECT id, name, statement, embedding, keywords, negative_keywords, is_active, created_at, updated_at
			FROM research_statements
			WHERE id = ?
		`;
		db.get(query, [Number(id)], (err, row) => {
			if (err) {
				return reject(err);
			}
			resolve(row || null);
		});
	});
}

function createResearchStatement({
	name,
	statement,
	keywords,
	negative_keywords,
	is_active = true,
}) {
	return new Promise((resolve, reject) => {
		const insert = `
			INSERT INTO research_statements (name, statement, keywords, negative_keywords, is_active)
			VALUES (?, ?, ?, ?, ?)
		`;
		db.run(
			insert,
			[
				String(name || "").trim(),
				String(statement || "").trim(),
				typeof keywords === "string" ? keywords : JSON.stringify([]),
				typeof negative_keywords === "string"
					? negative_keywords
					: JSON.stringify([]),
				is_active ? 1 : 0,
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

function updateResearchStatement(
	id,
	{ name, statement, keywords, negative_keywords, is_active }
) {
	return new Promise((resolve, reject) => {
		const fields = [];
		const params = [];
		if (typeof name === "string") {
			fields.push("name = ?");
			params.push(name.trim());
		}
		if (typeof statement === "string") {
			fields.push("statement = ?");
			params.push(statement.trim());
		}
		if (typeof keywords === "string") {
			fields.push("keywords = ?");
			params.push(keywords);
		}
		if (typeof negative_keywords === "string") {
			fields.push("negative_keywords = ?");
			params.push(negative_keywords);
		}
		if (typeof is_active === "boolean") {
			fields.push("is_active = ?");
			params.push(is_active ? 1 : 0);
		}
		fields.push("updated_at = CURRENT_TIMESTAMP");
		const sql = `UPDATE research_statements SET ${fields.join(
			", "
		)} WHERE id = ?`;
		params.push(Number(id));
		db.run(sql, params, function (err) {
			if (err) {
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

function deleteResearchStatement(id) {
	return new Promise((resolve, reject) => {
		const sql = `DELETE FROM research_statements WHERE id = ?`;
		db.run(sql, [Number(id)], function (err) {
			if (err) {
				return reject(err);
			}
			resolve(this.changes);
		});
	});
}

module.exports = {
	db,
	initializeDatabase,
	insertSampleData,
	getAllItems,
	getItemsFiltered,
	searchItems,
	insertContentItem,
	insertContentItems,
	closeDatabase,
	getAiUsageForDate,
	getTodayAiUsage,
	incrementAiUsage,
	// research statements
	getAllResearchStatements,
	getResearchStatementById,
	createResearchStatement,
	updateResearchStatement,
	deleteResearchStatement,
};
