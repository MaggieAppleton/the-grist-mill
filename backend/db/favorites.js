const { db } = require("./connection");
const { upsertUserRating } = require("./userRatings");

function toggleFavorite(contentItemId, isFavorite, activeResearchStatementId) {
	return new Promise((resolve, reject) => {
		const itemId = Number(contentItemId);
		if (!Number.isFinite(itemId) || itemId <= 0) {
			return reject(new Error("Invalid content_item_id"));
		}

		db.serialize(() => {
			db.run("BEGIN TRANSACTION", (beginErr) => {
				if (beginErr) return reject(beginErr);

				const updateSql = `
					UPDATE content_items
					SET is_favorite = ?,
						favorited_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END
					WHERE id = ?
				`;

				db.run(updateSql, [isFavorite ? 1 : 0, !!isFavorite, itemId], function (updateErr) {
					if (updateErr) {
						db.run("ROLLBACK");
						return reject(updateErr);
					}

					if (this.changes === 0) {
						db.run("ROLLBACK");
						return reject(new Error("Content item not found"));
					}

					const changesCount = this.changes;

					if (isFavorite && activeResearchStatementId) {
						const statementId = Number(activeResearchStatementId);
						if (Number.isFinite(statementId) && statementId > 0) {
							upsertUserRating(itemId, statementId, 4)
								.then(() => {
									db.run("COMMIT", (commitErr) => {
										if (commitErr) return reject(commitErr);
										resolve({ changes: changesCount, ratingSet: true });
									});
								})
								.catch((ratingErr) => {
									console.warn("Failed to set rating when favoriting:", ratingErr.message);
									db.run("COMMIT", (commitErr) => {
										if (commitErr) return reject(commitErr);
										resolve({ changes: changesCount, ratingSet: false });
									});
								});
							return;
						}
					}

					db.run("COMMIT", (commitErr) => {
						if (commitErr) return reject(commitErr);
						resolve({ changes: changesCount, ratingSet: false });
					});
				});
			});
		});
	});
}

function getFavoriteItems({ limit = 50, offset = 0 } = {}) {
	return new Promise((resolve, reject) => {
		const sql = `
			SELECT id, source_type, source_id, title, summary, page_text, raw_content, url, highlight, is_favorite, favorited_at, created_at, collected_at
			FROM content_items
			WHERE is_favorite = 1
			ORDER BY favorited_at DESC, created_at DESC
			LIMIT ? OFFSET ?
		`;

		db.all(sql, [Number(limit) || 50, Number(offset) || 0], (err, rows) => {
			if (err) return reject(err);
			resolve(rows || []);
		});
	});
}

module.exports = {
	toggleFavorite,
	getFavoriteItems,
};


