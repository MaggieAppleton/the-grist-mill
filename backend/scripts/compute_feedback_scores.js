const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
	initializeDatabase,
	getActiveResearchStatements,
	getRatedItemsWithEmbeddings,
	getItemsMissingFeedbackScoreForStatement,
	updateContentFeaturesFeedbackScore,
	closeDatabase,
} = require("../database");

const {
	batchComputeFeedbackScores,
	getFeedbackScoringStats,
} = require("../services/feedbackScoring");

async function main() {
	await initializeDatabase();

	const stmtArg = process.argv.find((a) => a && a.startsWith("--statement="));
	const limitArg = process.argv.find((a) => a && a.startsWith("--limit="));
	const oneStatementId = stmtArg ? Number(stmtArg.split("=")[1]) : null;
	const batchLimit = limitArg
		? Number(limitArg.split("=")[1])
		: Number(process.env.FEEDBACK_BATCH_LIMIT || 100);

	const statements = oneStatementId
		? (await getActiveResearchStatements()).filter(
				(s) => s.id === oneStatementId
		  )
		: await getActiveResearchStatements();

	if (!statements || statements.length === 0) {
		console.log("No active research statements found. Exiting.");
		await closeDatabase();
		process.exit(0);
	}

	let totalUpdated = 0;
	for (const stmt of statements) {
		console.log(
			`[Feedback] Processing feedback scores for statement #${stmt.id} - ${stmt.name}`
		);

		// Get all rated items with embeddings for this statement
		const ratedItems = await getRatedItemsWithEmbeddings(stmt.id);
		console.log(
			`[Feedback] Found ${ratedItems.length} rated items for statement #${stmt.id}`
		);

		// Show feedback scoring statistics
		const stats = getFeedbackScoringStats(ratedItems);
		if (stats.available) {
			console.log(
				`[Feedback] Rating distribution: Very Relevant=${stats.ratingDistribution[4]}, ` +
				`Relevant=${stats.ratingDistribution[3]}, Weakly Relevant=${stats.ratingDistribution[2]}, ` +
				`Not Relevant=${stats.ratingDistribution[1]} (avg=${stats.averageRating.toFixed(2)})`
			);
		} else {
			console.log(
				`[Feedback] No ratings available for statement #${stmt.id} - skipping feedback scoring`
			);
			continue;
		}

		// Get items that need feedback scores computed
		const itemsToScore = await getItemsMissingFeedbackScoreForStatement(stmt.id, {
			limit: batchLimit,
		});
		console.log(
			`[Feedback] Found ${itemsToScore.length} items needing feedback scores for statement #${stmt.id}`
		);

		if (itemsToScore.length === 0) {
			console.log(
				`[Feedback] No items need feedback scoring for statement #${stmt.id}`
			);
			continue;
		}

		// Batch compute feedback scores
		const feedbackResults = batchComputeFeedbackScores(itemsToScore, ratedItems, {
			minSimilarityThreshold: Number(process.env.FEEDBACK_MIN_SIMILARITY || 0.1),
			similarityDecayFactor: Number(process.env.FEEDBACK_DECAY_FACTOR || 2.0),
			maxSimilarItems: Number(process.env.FEEDBACK_MAX_SIMILAR || 50),
		});

		// Update database with feedback scores
		for (const result of feedbackResults) {
			try {
				await updateContentFeaturesFeedbackScore(
					result.content_item_id,
					result.research_statement_id,
					result.feedback_score
				);
				totalUpdated += 1;
				console.log(
					`[Feedback] Updated item ${result.content_item_id} (stmt ${
						result.research_statement_id
					}) -> feedback_score=${result.feedback_score.toFixed(3)}`
				);
			} catch (err) {
				console.error(
					`[Feedback] Failed to update item ${result.content_item_id} (stmt ${result.research_statement_id}):`,
					err.message
				);
			}
		}

		// Show summary statistics for computed scores
		const nonZeroScores = feedbackResults
			.map(r => r.feedback_score)
			.filter(score => score > 0);
		
		if (nonZeroScores.length > 0) {
			const avgScore = nonZeroScores.reduce((sum, score) => sum + score, 0) / nonZeroScores.length;
			const maxScore = Math.max(...nonZeroScores);
			console.log(
				`[Feedback] Score statistics: ${nonZeroScores.length}/${feedbackResults.length} items with feedback scores > 0, ` +
				`avg=${avgScore.toFixed(3)}, max=${maxScore.toFixed(3)}`
			);
		} else {
			console.log(
				`[Feedback] All computed feedback scores were 0 (no similar rated items found)`
			);
		}
	}

	console.log(`[Feedback] Done. Total updated: ${totalUpdated}`);
	await closeDatabase();
}

main().catch(async (err) => {
	console.error("[Feedback] Fatal error:", err);
	await closeDatabase();
	process.exit(1);
});