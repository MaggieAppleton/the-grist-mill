const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const db = require("../database");
const {
	computeKeywordScores,
	computeHybridScores,
} = require("../scripts/compute_hybrid_scores");
const { batchComputeFeedbackScores } = require("../services/feedbackScoring");

// In-memory progress state (single-process prototype)
const progress = {
	running: false,
	statementId: null,
	phase: null, // embedding|similarity|feedback|hybrid|done
	processed: 0,
	updated: 0,
	total: 0,
	startedAt: null,
	finishedAt: null,
	error: null,
};

function getStatus() {
	return { ...progress };
}

async function resetScores(statementId, { resetFeedback = true } = {}) {
	await db.resetSimilarityAndFinalForStatement(statementId);
	if (resetFeedback) {
		await db.resetFeedbackForStatement(statementId);
	}
}

async function computeFeedback(statement, { batchSize = 100 } = {}) {
	const rated = await db.getRatedItemsWithEmbeddings(statement.id);
	if (!rated || rated.length === 0) return { processed: 0, updated: 0 };
	let processed = 0;
	let updated = 0;
	let hasMore = true;
	while (hasMore) {
		const items = await db.getItemsMissingFeedbackScoreForStatement(
			statement.id,
			{
				limit: batchSize,
			}
		);
		if (items.length === 0) {
			hasMore = false;
			break;
		}
		const results = batchComputeFeedbackScores(items, rated, {
			minSimilarityThreshold: Number(
				process.env.FEEDBACK_MIN_SIMILARITY || 0.1
			),
			similarityDecayFactor: Number(process.env.FEEDBACK_DECAY_FACTOR || 2.0),
			maxSimilarItems: Number(process.env.FEEDBACK_MAX_SIMILAR || 50),
		});
		for (const r of results) {
			try {
				await db.updateContentFeaturesFeedbackScore(
					r.content_item_id,
					r.research_statement_id,
					r.feedback_score
				);
				updated += 1;
			} catch (_) {}
		}
		processed += items.length;
	}
	return { processed, updated };
}

async function runRerank({ statementId, force = true, batchSize = 100 } = {}) {
	if (progress.running) {
		return { ok: false, error: "Rerank already running" };
	}

	progress.running = true;
	progress.statementId = statementId || null;
	progress.phase = "starting";
	progress.processed = 0;
	progress.updated = 0;
	progress.total = 0;
	progress.startedAt = new Date().toISOString();
	progress.finishedAt = null;
	progress.error = null;

	try {
		await db.initializeDatabase();

		const statements = statementId
			? (await db.getActiveResearchStatements()).filter(
					(s) => s.id === statementId
			  )
			: await db.getActiveResearchStatements();

		if (!statements || statements.length === 0) {
			throw new Error("No active research statements found");
		}

		for (const stmt of statements) {
			// Reset scores if forcing a full rerank
			if (force) {
				progress.phase = "reset";
				await resetScores(stmt.id, { resetFeedback: true });
			}

			// Similarity (reuse existing script logic via DB helpers)
			progress.phase = "similarity";
			let hasMoreSim = true;
			while (hasMoreSim) {
				const rows = await db.getItemsMissingSimilarityForStatement(stmt.id, {
					limit: batchSize,
				});
				if (rows.length === 0) {
					hasMoreSim = false;
					break;
				}
				for (const row of rows) {
					try {
						const {
							parseEmbeddingPayload,
							cosineSimilarity,
							determineRelevanceTier,
						} = require("../services/contentEmbeddings");
						const contentEmbedding = parseEmbeddingPayload(
							row.content_embedding
						);
						if (
							!Array.isArray(contentEmbedding) ||
							contentEmbedding.length === 0
						)
							continue;
						const stmtRow = await db.getResearchStatementById(stmt.id);
						const stmtEmbedding =
							require("../services/contentEmbeddings").parseEmbeddingPayload(
								stmtRow && stmtRow.embedding
							);
						if (!Array.isArray(stmtEmbedding) || stmtEmbedding.length === 0)
							continue;
						const sim = cosineSimilarity(contentEmbedding, stmtEmbedding);
						const tier = determineRelevanceTier(sim);
						await db.updateContentFeaturesSimilarityAndTier(
							row.content_item_id,
							row.research_statement_id,
							sim,
							tier
						);
						progress.updated += 1;
					} catch (_) {}
				}
				progress.processed += rows.length;
			}

			// Feedback
			progress.phase = "feedback";
			const fb = await computeFeedback(stmt, { batchSize });
			progress.processed += fb.processed;
			progress.updated += fb.updated;

			// Hybrid
			progress.phase = "hybrid";
			let hasMoreHybrid = true;
			while (hasMoreHybrid) {
				const features = await db.getItemsMissingFinalScoreForStatement(
					stmt.id,
					{
						limit: batchSize,
					}
				);
				if (features.length === 0) {
					hasMoreHybrid = false;
					break;
				}
				const {
					batchCalculateHybridScores,
				} = require("../services/hybridScoring");
				const results = batchCalculateHybridScores(features);
				try {
					const res = await db.batchUpdateContentFeaturesHybridScores(results);
					progress.updated += Number(res?.completed || 0);
				} catch (_) {
					for (const r of results) {
						try {
							await db.updateContentFeaturesHybridScore(
								r.content_item_id,
								r.research_statement_id,
								r.finalScore,
								r.relevanceTier
							);
							progress.updated += 1;
						} catch (_) {}
					}
				}
				progress.processed += features.length;
			}
		}

		progress.phase = "done";
		progress.finishedAt = new Date().toISOString();
		progress.running = false;
		return { ok: true };
	} catch (err) {
		progress.error = err.message || String(err);
		progress.phase = "error";
		progress.finishedAt = new Date().toISOString();
		progress.running = false;
		return { ok: false, error: progress.error };
	} finally {
		try {
			await db.closeDatabase();
		} catch (_) {}
	}
}

module.exports = { runRerank, getStatus };
