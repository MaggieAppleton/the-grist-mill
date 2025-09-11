#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
	initializeDatabase,
	getActiveResearchStatements,
	getItemsMissingEmbeddingForStatement,
	upsertContentFeaturesEmbedding,
	closeDatabase,
} = require("../database");
const {
	extractContentText,
	generateEmbeddingForText,
} = require("../services/contentEmbeddings");

async function main() {
	await initializeDatabase();

	const arg = process.argv.find((a) => a && a.startsWith("--statement="));
	const limitArg = process.argv.find((a) => a && a.startsWith("--limit="));
	const oneStatementId = arg ? Number(arg.split("=")[1]) : null;
	const batchLimit = limitArg
		? Number(limitArg.split("=")[1])
		: Number(process.env.EMBED_BATCH_LIMIT || 50);

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

	let totalProcessed = 0;
	for (const stmt of statements) {
		console.log(
			`[Embeddings] Processing for statement #${stmt.id} - ${stmt.name}`
		);
		const items = await getItemsMissingEmbeddingForStatement(stmt.id, {
			limit: batchLimit,
		});
		console.log(
			`[Embeddings] Found ${items.length} items missing embeddings for statement #${stmt.id}`
		);

		for (const item of items) {
			try {
				const text = extractContentText(item);
				if (!text || text.trim().length === 0) {
					// Skip items without meaningful text
					continue;
				}
				const embedding = await generateEmbeddingForText(text);
				await upsertContentFeaturesEmbedding(item.id, stmt.id, embedding);
				totalProcessed += 1;
				console.log(
					`[Embeddings] Upserted embedding for item ${item.id} (stmt ${stmt.id})`
				);
			} catch (err) {
				console.error(
					`[Embeddings] Failed for item ${item.id} (stmt ${stmt.id}):`,
					err.message
				);
			}
		}
	}

	console.log(`[Embeddings] Done. Total processed: ${totalProcessed}`);
	await closeDatabase();
}

main().catch(async (err) => {
	console.error("[Embeddings] Fatal error:", err);
	await closeDatabase();
	process.exit(1);
});
