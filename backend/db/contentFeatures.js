const { db } = require("./connection");

function getActiveResearchStatements() {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT id, name, statement, embedding, keywords, negative_keywords, is_active, created_at, updated_at
				FROM research_statements
				WHERE is_active = 1
				ORDER BY created_at DESC
			`;
		db.all(sql, [], (err, rows) => {
			if (err) return reject(err);
			resolve(rows || []);
		});
	});
}

function getItemsMissingEmbeddingForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT ci.id, ci.source_type, ci.source_id, ci.title, ci.summary, ci.page_text, ci.raw_content, ci.url
				FROM content_items ci
				LEFT JOIN content_features cf
				  ON cf.content_item_id = ci.id AND cf.research_statement_id = ?
				WHERE cf.id IS NULL OR cf.content_embedding IS NULL
				ORDER BY ci.created_at DESC
				LIMIT ?
			`;
		db.all(
			sql,
			[Number(researchStatementId), Math.max(1, Number(limit) || 100)],
			(err, rows) => {
				if (err) return reject(err);
				resolve(rows || []);
			}
		);
	});
}

function upsertContentFeaturesEmbedding(
	contentItemId,
	researchStatementId,
	embeddingVector
) {
	return new Promise((resolve, reject) => {
		let payload = null;
		try {
			if (Array.isArray(embeddingVector)) {
				payload = JSON.stringify(embeddingVector);
			} else if (embeddingVector == null) {
				payload = null;
			} else if (typeof embeddingVector === "string") {
				payload = embeddingVector;
			} else {
				payload = JSON.stringify(embeddingVector);
			}
		} catch (_) {
			payload = null;
		}
		const sql = `
				INSERT INTO content_features (content_item_id, research_statement_id, content_embedding, created_at, updated_at)
				VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
				ON CONFLICT(content_item_id, research_statement_id) DO UPDATE SET
				  content_embedding = excluded.content_embedding,
				  updated_at = CURRENT_TIMESTAMP
			`;
		db.run(
			sql,
			[Number(contentItemId), Number(researchStatementId), payload],
			function (err) {
				if (err) return reject(err);
				resolve(this.changes);
			}
		);
	});
}

function getItemsMissingSimilarityForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT cf.content_item_id, cf.research_statement_id, cf.content_embedding
				FROM content_features cf
				WHERE cf.research_statement_id = ?
				  AND cf.content_embedding IS NOT NULL
				  AND (cf.similarity_score IS NULL)
				ORDER BY cf.updated_at ASC
				LIMIT ?
			`;
		db.all(
			sql,
			[Number(researchStatementId), Math.max(1, Number(limit) || 100)],
			(err, rows) => {
				if (err) return reject(err);
				resolve(rows || []);
			}
		);
	});
}

function updateContentFeaturesSimilarityAndTier(
	contentItemId,
	researchStatementId,
	similarityScore,
	relevanceTier
) {
	return new Promise((resolve, reject) => {
		const sql = `
				UPDATE content_features
				SET similarity_score = ?,
				    relevance_tier = ?,
				    updated_at = CURRENT_TIMESTAMP
				WHERE content_item_id = ? AND research_statement_id = ?
			`;
		db.run(
			sql,
			[
				Number(similarityScore) || 0,
				Number(relevanceTier) || null,
				Number(contentItemId),
				Number(researchStatementId),
			],
			function (err) {
				if (err) return reject(err);
				resolve(this.changes);
			}
		);
	});
}

module.exports = {
	getActiveResearchStatements,
	getItemsMissingEmbeddingForStatement,
	upsertContentFeaturesEmbedding,
	getItemsMissingSimilarityForStatement,
	updateContentFeaturesSimilarityAndTier,
};
