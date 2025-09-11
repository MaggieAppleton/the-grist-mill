const { db } = require("./connection");

function upsertUserRating(contentItemId, researchStatementId, rating) {
	return new Promise((resolve, reject) => {
		const normalized = Math.max(1, Math.min(4, Number(rating) || 1));
		const sql = `
		            INSERT INTO user_ratings (content_item_id, research_statement_id, rating, created_at)
		            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		            ON CONFLICT(content_item_id, research_statement_id) DO UPDATE SET
		                rating = excluded.rating,
		                created_at = CASE
		                    WHEN user_ratings.rating IS NULL OR user_ratings.rating = excluded.rating THEN user_ratings.created_at
		                    ELSE CURRENT_TIMESTAMP
		                END
		        `;
		db.run(
			sql,
			[Number(contentItemId), Number(researchStatementId), normalized],
			function (err) {
				if (err) return reject(err);
				resolve(this.changes);
			}
		);
	});
}

function getUserRatingStats({ researchStatementId } = {}) {
	return new Promise((resolve, reject) => {
		const params = [];
		let where = "";
		if (researchStatementId) {
			where = "WHERE research_statement_id = ?";
			params.push(Number(researchStatementId));
		}
		const sql = `
		            SELECT 
		                COUNT(*) as total,
		                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as very_relevant,
		                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as relevant,
		                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as weakly_relevant,
		                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as not_relevant
		            FROM user_ratings
		            ${where}
		        `;
		db.get(sql, params, (err, row) => {
			if (err) return reject(err);
			resolve(
				row || {
					total: 0,
					very_relevant: 0,
					relevant: 0,
					weakly_relevant: 0,
					not_relevant: 0,
				}
			);
		});
	});
}

module.exports = {
	upsertUserRating,
	getUserRatingStats,
};
