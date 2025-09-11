const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
	initializeDatabase,
	closeDatabase,
	getActiveResearchStatements,
	getResearchStatementById,
	getItemsMissingSimilarityForStatement,
	updateContentFeaturesSimilarityAndTier,
} = require("../database");

const {
	parseEmbeddingPayload,
	cosineSimilarity,
	determineRelevanceTier,
} = require("../services/contentEmbeddings");

async function main() {
	await initializeDatabase();

	const stmtArg = process.argv.find((a) => a && a.startsWith("--statement="));
	const limitArg = process.argv.find((a) => a && a.startsWith("--limit="));
	const oneStatementId = stmtArg ? Number(stmtArg.split("=")[1]) : null;
	const batchLimit = limitArg
		? Number(limitArg.split("=")[1])
		: Number(process.env.SIMILARITY_BATCH_LIMIT || 100);

	const statements = oneStatementId
		? (await getActiveResearchStatements()).filter(
				(s) => s.id === oneStatementId
		  )
		: await getActiveResearchStatements();

	if (!statements || statements.length === 0) {
		console.log("[Similarity] No active research statements found. Exiting.");
		await closeDatabase();
		process.exit(0);
	}

	let totalUpdated = 0;
	for (const stmt of statements) {
		console.log(
			`[Similarity] Processing similarity for statement #${stmt.id} - ${stmt.name}`
		);
		// Ensure we have a statement embedding
		const stmtRow = await getResearchStatementById(stmt.id);
		const stmtEmbedding = parseEmbeddingPayload(stmtRow && stmtRow.embedding);
		if (!Array.isArray(stmtEmbedding) || stmtEmbedding.length === 0) {
			console.warn(
				`[Similarity] Skipping statement #${stmt.id} - missing embedding`
			);
			continue;
		}

		const rows = await getItemsMissingSimilarityForStatement(stmt.id, {
			limit: batchLimit,
		});
		console.log(
			`[Similarity] Found ${rows.length} feature rows needing similarity for statement #${stmt.id}`
		);
		for (const row of rows) {
			try {
				const contentEmbedding = parseEmbeddingPayload(row.content_embedding);
				if (!Array.isArray(contentEmbedding) || contentEmbedding.length === 0) {
					continue;
				}
				const sim = cosineSimilarity(contentEmbedding, stmtEmbedding);
				const tier = determineRelevanceTier(sim);
				await updateContentFeaturesSimilarityAndTier(
					row.content_item_id,
					row.research_statement_id,
					sim,
					tier
				);
				totalUpdated += 1;
				console.log(
					`[Similarity] Updated item ${row.content_item_id} (stmt ${
						row.research_statement_id
					}) -> sim=${sim.toFixed(3)}, tier=${tier}`
				);
			} catch (err) {
				console.error(
					`[Similarity] Failed for item ${row.content_item_id} (stmt ${row.research_statement_id}):`,
					err.message
				);
			}
		}
	}

	console.log(`[Similarity] Done. Total updated: ${totalUpdated}`);
	await closeDatabase();
}

main().catch(async (err) => {
	console.error("[Similarity] Fatal error:", err);
	await closeDatabase();
	process.exit(1);
});
