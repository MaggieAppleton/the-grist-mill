const { db } = require("./connection");

function getAllItems() {
	return new Promise((resolve, reject) => {
		const query = `
		      SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, is_favorite, favorited_at, created_at, collected_at
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
		      SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, is_favorite, favorited_at, created_at, collected_at
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

function searchItems({ query, source, limit = 50, offset = 0 } = {}) {
	return new Promise((resolve, reject) => {
		if (!query || typeof query !== "string" || query.trim().length === 0) {
			return getItemsFiltered({ source, limit, offset })
				.then(resolve)
				.catch(reject);
		}

		const whereClauses = [];
		const params = [];

		const searchTerm = `%${query.trim()}%`;
		whereClauses.push(
			"(title LIKE ? OR summary LIKE ? OR raw_content LIKE ? OR page_text LIKE ?)"
		);
		params.push(searchTerm, searchTerm, searchTerm, searchTerm);

		if (source) {
			whereClauses.push("source_type = ?");
			params.push(source);
		}

		const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;
		const searchQuery = `
				SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, is_favorite, favorited_at, created_at, collected_at
				FROM content_items
				${whereSQL}
				ORDER BY 
					CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
					created_at DESC
				LIMIT ? OFFSET ?
			`;

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

function getItemIdsBySource(sourceType, sourceIds) {
	return new Promise((resolve, reject) => {
		try {
			if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
				return resolve([]);
			}
			const placeholders = sourceIds.map(() => "?").join(",");
			const sql = `SELECT id, source_id FROM content_items WHERE source_type = ? AND source_id IN (${placeholders})`;
			db.all(
				sql,
				[String(sourceType), ...sourceIds.map((s) => String(s))],
				(err, rows) => {
					if (err) return reject(err);
					resolve(rows || []);
				}
			);
		} catch (e) {
			reject(e);
		}
	});
}

module.exports = {
	getAllItems,
	getItemsFiltered,
	searchItems,
	insertContentItem,
	insertContentItems,
	getItemIdsBySource,
};
