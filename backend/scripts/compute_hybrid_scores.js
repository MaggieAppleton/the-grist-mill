#!/usr/bin/env node
/**
 * Compute hybrid scores for content items
 *
 * This script combines keyword, similarity, and feedback scores into final hybrid scores
 * and updates relevance tiers accordingly.
 *
 * Usage:
 *   node scripts/compute_hybrid_scores.js [options]
 *
 * Options:
 *   --statement-id ID  Process specific research statement only
 *   --batch-size N     Process N items at a time (default: 50)
 *   --force           Re-compute scores even if they already exist
 *   --dry-run         Show what would be done without making changes
 */

const db = require("../database");
const { batchCalculateKeywordScores } = require("../services/keywordScoring");
const { batchCalculateHybridScores } = require("../services/hybridScoring");

async function main() {
	const args = process.argv.slice(2);
	const options = {
		statementId: null,
		batchSize: 50,
		force: false,
		dryRun: false,
	};

	// Parse command line arguments
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--statement-id":
				options.statementId = Number(args[++i]);
				break;
			case "--batch-size":
				options.batchSize = Number(args[++i]) || 50;
				break;
			case "--force":
				options.force = true;
				break;
			case "--dry-run":
				options.dryRun = true;
				break;
			case "--help":
				console.log(`
Usage: node scripts/compute_hybrid_scores.js [options]

Options:
  --statement-id ID  Process specific research statement only
  --batch-size N     Process N items at a time (default: 50)  
  --force           Re-compute scores even if they already exist
  --dry-run         Show what would be done without making changes
  --help            Show this help message
				`);
				process.exit(0);
			default:
				console.warn(`Unknown option: ${arg}`);
		}
	}

	console.log("🧮 Starting hybrid score computation...");
	console.log("Options:", options);

	try {
		// Get active research statements
		const statements = await db.getActiveResearchStatements();

		if (statements.length === 0) {
			console.log("No active research statements found.");
			return;
		}

		const targetStatements = options.statementId
			? statements.filter((s) => s.id === options.statementId)
			: statements;

		if (targetStatements.length === 0) {
			console.log(
				`No research statement found with ID: ${options.statementId}`
			);
			return;
		}

		console.log(`Processing ${targetStatements.length} research statement(s)`);

		let totalProcessed = 0;
		let totalUpdated = 0;

		for (const statement of targetStatements) {
			console.log(`\n📊 Processing: "${statement.name}"`);

			const result = await processStatementScores(statement, options);
			totalProcessed += result.processed;
			totalUpdated += result.updated;

			console.log(
				`  ✅ Processed: ${result.processed}, Updated: ${result.updated}`
			);
		}

		console.log(`\n🎯 Summary:`);
		console.log(`  Total processed: ${totalProcessed}`);
		console.log(`  Total updated: ${totalUpdated}`);

		if (options.dryRun) {
			console.log("  (Dry run - no changes were made)");
		}
	} catch (error) {
		console.error("❌ Error computing hybrid scores:", error);
		process.exit(1);
	} finally {
		await db.closeDatabase();
	}
}

async function processStatementScores(statement, options) {
	let processed = 0;
	let updated = 0;

	// Step 1: Compute keyword scores for items missing them
	console.log("  🔤 Computing keyword scores...");
	const keywordResult = await computeKeywordScores(statement, options);
	processed += keywordResult.processed;
	updated += keywordResult.updated;

	// Step 2: Compute hybrid scores for items with all component scores
	console.log("  🔄 Computing hybrid scores...");
	const hybridResult = await computeHybridScores(statement, options);
	processed += hybridResult.processed;
	updated += hybridResult.updated;

	return { processed, updated };
}

async function computeKeywordScores(statement, options) {
	let processed = 0;
	let updated = 0;
	let hasMore = true;

	while (hasMore) {
		// Get items missing keyword scores
		const items = await db.getItemsMissingKeywordScoreForStatement(
			statement.id,
			{ limit: options.batchSize }
		);

		if (items.length === 0) {
			hasMore = false;
			break;
		}

		console.log(`    Processing ${items.length} items for keyword scoring...`);

		if (options.dryRun) {
			console.log(
				`    [DRY RUN] Would compute keyword scores for ${items.length} items`
			);
			processed += items.length;
			break; // Don't continue in dry run mode
		}

		// Calculate keyword scores
		const scores = batchCalculateKeywordScores(items, statement);

		// Update database
		for (const score of scores) {
			try {
				await db.updateContentFeaturesKeywordScore(
					score.content_item_id,
					score.research_statement_id,
					score.keyword_score
				);
				updated++;
			} catch (error) {
				console.warn(
					`    Failed to update keyword score for item ${score.content_item_id}:`,
					error.message
				);
			}
		}

		processed += items.length;

		// Small delay to avoid overwhelming the database
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	return { processed, updated };
}

async function computeHybridScores(statement, options) {
	let processed = 0;
	let updated = 0;
	let hasMore = true;

	while (hasMore) {
		// Get items missing final scores
		const features = await db.getItemsMissingFinalScoreForStatement(
			statement.id,
			{ limit: options.batchSize }
		);

		if (features.length === 0) {
			hasMore = false;
			break;
		}

		console.log(
			`    Processing ${features.length} items for hybrid scoring...`
		);

		if (options.dryRun) {
			console.log(
				`    [DRY RUN] Would compute hybrid scores for ${features.length} items`
			);
			processed += features.length;
			break; // Don't continue in dry run mode
		}

		// Calculate hybrid scores
		const hybridResults = batchCalculateHybridScores(features);

		// Batch update database
		try {
			const updateResult = await db.batchUpdateContentFeaturesHybridScores(
				hybridResults
			);
			updated += updateResult.completed || 0;

			if (updateResult.failed > 0) {
				console.warn(`    ${updateResult.failed} updates failed`);
			}
		} catch (error) {
			console.warn(`    Failed batch update:`, error.message);

			// Fall back to individual updates
			for (const result of hybridResults) {
				try {
					await db.updateContentFeaturesHybridScore(
						result.content_item_id,
						result.research_statement_id,
						result.finalScore,
						result.relevanceTier
					);
					updated++;
				} catch (individualError) {
					console.warn(
						`    Failed individual update for item ${result.content_item_id}:`,
						individualError.message
					);
				}
			}
		}

		processed += features.length;

		// Small delay to avoid overwhelming the database
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	return { processed, updated };
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
	console.log("\n👋 Gracefully shutting down...");
	try {
		await db.closeDatabase();
	} catch (error) {
		console.error("Error closing database:", error);
	}
	process.exit(0);
});

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	process.exit(1);
});

if (require.main === module) {
	main();
}

module.exports = {
	processStatementScores,
	computeKeywordScores,
	computeHybridScores,
};
