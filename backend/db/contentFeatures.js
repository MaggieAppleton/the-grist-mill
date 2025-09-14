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

// Get rated items with their embeddings for feedback-based scoring
function getRatedItemsWithEmbeddings(
	researchStatementId,
	{ limit = 500 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT 
					ur.content_item_id,
					ur.research_statement_id,
					ur.rating,
					cf.content_embedding
				FROM user_ratings ur
				JOIN content_features cf 
					ON cf.content_item_id = ur.content_item_id 
					AND cf.research_statement_id = ur.research_statement_id
				WHERE ur.research_statement_id = ?
				  AND cf.content_embedding IS NOT NULL
				ORDER BY ur.created_at DESC
				LIMIT ?
			`;
		db.all(
			sql,
			[Number(researchStatementId), Math.max(1, Number(limit) || 500)],
			(err, rows) => {
				if (err) return reject(err);
				resolve(rows || []);
			}
		);
	});
}

// Get items that need feedback scores computed (have embeddings but no feedback score)
function getItemsMissingFeedbackScoreForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT 
					cf.content_item_id,
					cf.research_statement_id,
					cf.content_embedding
				FROM content_features cf
				LEFT JOIN user_ratings ur 
					ON ur.content_item_id = cf.content_item_id 
					AND ur.research_statement_id = cf.research_statement_id
				WHERE cf.research_statement_id = ?
				  AND cf.content_embedding IS NOT NULL
				  AND ur.id IS NULL
				  AND (cf.feedback_score IS NULL)
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

// Update feedback score in content_features
function updateContentFeaturesFeedbackScore(
	contentItemId,
	researchStatementId,
	feedbackScore
) {
	return new Promise((resolve, reject) => {
		const sql = `
				UPDATE content_features
				SET feedback_score = ?,
				    updated_at = CURRENT_TIMESTAMP
				WHERE content_item_id = ? AND research_statement_id = ?
			`;
		db.run(
			sql,
			[
				Number(feedbackScore) || 0,
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

// Update keyword score in content_features
function updateContentFeaturesKeywordScore(
	contentItemId,
	researchStatementId,
	keywordScore
) {
	return new Promise((resolve, reject) => {
		const sql = `
				UPDATE content_features
				SET keyword_score = ?,
				    updated_at = CURRENT_TIMESTAMP
				WHERE content_item_id = ? AND research_statement_id = ?
			`;
		db.run(
			sql,
			[
				Number(keywordScore) || 0,
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

// Update final score and relevance tier in content_features
function updateContentFeaturesHybridScore(
	contentItemId,
	researchStatementId,
	finalScore,
	relevanceTier
) {
	return new Promise((resolve, reject) => {
		const sql = `
				UPDATE content_features
				SET final_score = ?,
				    relevance_tier = ?,
				    updated_at = CURRENT_TIMESTAMP
				WHERE content_item_id = ? AND research_statement_id = ?
			`;
		db.run(
			sql,
			[
				Number(finalScore) || 0,
				Number(relevanceTier) || 1,
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

// Batch update multiple content features with hybrid scores
function batchUpdateContentFeaturesHybridScores(updates) {
	return new Promise((resolve, reject) => {
		if (!Array.isArray(updates) || updates.length === 0) {
			return resolve(0);
		}

		db.serialize(() => {
			db.run("BEGIN TRANSACTION", (beginErr) => {
				if (beginErr) return reject(beginErr);

				const sql = `
					UPDATE content_features
					SET final_score = ?,
					    relevance_tier = ?,
					    updated_at = CURRENT_TIMESTAMP
					WHERE content_item_id = ? AND research_statement_id = ?
				`;

				let completed = 0;
				let failed = 0;

				const stmt = db.prepare(sql);

				for (const update of updates) {
					stmt.run(
						[
							Number(update.finalScore) || 0,
							Number(update.relevanceTier) || 1,
							Number(update.content_item_id),
							Number(update.research_statement_id),
						],
						function (err) {
							if (err) {
								console.warn(
									`Failed to update hybrid score for item ${update.content_item_id}:`,
									err
								);
								failed++;
							} else {
								completed++;
							}

							if (completed + failed === updates.length) {
								stmt.finalize((finalizeErr) => {
									if (finalizeErr) {
										db.run("ROLLBACK", () => reject(finalizeErr));
									} else {
										db.run("COMMIT", (commitErr) => {
											if (commitErr) return reject(commitErr);
											resolve({ completed, failed, total: updates.length });
										});
									}
								});
							}
						}
					);
				}
			});
		});
	});
}

// Get items missing keyword scores for a research statement
function getItemsMissingKeywordScoreForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT 
					ci.id, ci.title, ci.summary, ci.page_text, ci.raw_content,
					cf.content_item_id, cf.research_statement_id
				FROM content_items ci
				JOIN content_features cf ON cf.content_item_id = ci.id
				WHERE cf.research_statement_id = ?
				  AND (cf.keyword_score IS NULL)
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

// Get items missing final scores (hybrid scoring) for a research statement
function getItemsMissingFinalScoreForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	return new Promise((resolve, reject) => {
		const sql = `
				SELECT 
					cf.content_item_id,
					cf.research_statement_id,
					cf.keyword_score,
					cf.similarity_score,
					cf.feedback_score,
					cf.final_score,
					cf.relevance_tier
				FROM content_features cf
				WHERE cf.research_statement_id = ?
				  AND cf.keyword_score IS NOT NULL
				  AND cf.similarity_score IS NOT NULL
				  AND (cf.final_score IS NULL OR cf.relevance_tier IS NULL)
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

// Reset similarity and final score fields for a research statement
function resetSimilarityAndFinalForStatement(researchStatementId) {
	return new Promise((resolve, reject) => {
		const sql = `
                UPDATE content_features
                SET similarity_score = NULL,
                    final_score = NULL,
                    relevance_tier = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE research_statement_id = ?
            `;
		db.run(sql, [Number(researchStatementId)], function (err) {
			if (err) return reject(err);
			resolve(this.changes);
		});
	});
}

// Reset feedback scores for a research statement
function resetFeedbackForStatement(researchStatementId) {
	return new Promise((resolve, reject) => {
		const sql = `
                UPDATE content_features
                SET feedback_score = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE research_statement_id = ?
            `;
		db.run(sql, [Number(researchStatementId)], function (err) {
			if (err) return reject(err);
			resolve(this.changes);
		});
	});
}

// Get counts for monitoring progress for a statement
function getFeatureCountsForStatement(researchStatementId) {
	return new Promise((resolve, reject) => {
		const sql = `
                SELECT 
                  COUNT(*) AS total,
                  SUM(CASE WHEN similarity_score IS NULL THEN 1 ELSE 0 END) AS missing_similarity,
                  SUM(CASE WHEN feedback_score IS NULL THEN 1 ELSE 0 END) AS missing_feedback,
                  SUM(CASE WHEN final_score IS NULL OR relevance_tier IS NULL THEN 1 ELSE 0 END) AS missing_final
                FROM content_features
                WHERE research_statement_id = ?
            `;
		db.get(sql, [Number(researchStatementId)], (err, row) => {
			if (err) return reject(err);
			resolve({
				total: Number(row?.total || 0),
				missing_similarity: Number(row?.missing_similarity || 0),
				missing_feedback: Number(row?.missing_feedback || 0),
				missing_final: Number(row?.missing_final || 0),
			});
		});
	});
}

module.exports = {
	getActiveResearchStatements,
	getItemsMissingEmbeddingForStatement,
	upsertContentFeaturesEmbedding,
	getItemsMissingSimilarityForStatement,
	updateContentFeaturesSimilarityAndTier,
	getRatedItemsWithEmbeddings,
	getItemsMissingFeedbackScoreForStatement,
	updateContentFeaturesFeedbackScore,
	// New hybrid scoring functions
	updateContentFeaturesKeywordScore,
	updateContentFeaturesHybridScore,
	batchUpdateContentFeaturesHybridScores,
	getItemsMissingKeywordScoreForStatement,
	getItemsMissingFinalScoreForStatement,
	resetSimilarityAndFinalForStatement,
	resetFeedbackForStatement,
	getFeatureCountsForStatement,
};
