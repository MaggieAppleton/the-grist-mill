const { db } = require("./db/connection");
const items = require("./db/items");
const aiUsage = require("./db/aiUsage");
const research = require("./db/researchStatements");
const contentFeatures = require("./db/contentFeatures");
const userRatings = require("./db/userRatings");
const favorites = require("./db/favorites");
const { initializeDatabase: initializeDatabaseImpl } = require("./db/schema");

// (removed legacy insertSampleData)

// Close database connection
function closeDatabase() {
	return new Promise((resolve) => {
		db.close((err) => {
			if (err) {
				console.error("Error closing database:", err.message);
			} else {
				console.log("Database connection closed.");
			}
			resolve();
		});
	});
}

// Helper: fetch item ids by source_type and an array of source_id values
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
	db,
	initializeDatabase: initializeDatabaseImpl,
	// items
	getAllItems: items.getAllItems,
	getItemsFiltered: items.getItemsFiltered,
	searchItems: items.searchItems,
	insertContentItem: items.insertContentItem,
	insertContentItems: items.insertContentItems,
	closeDatabase,
	getAiUsageForDate: aiUsage.getAiUsageForDate,
	getTodayAiUsage: aiUsage.getTodayAiUsage,
	incrementAiUsage: aiUsage.incrementAiUsage,
	// research statements
	getAllResearchStatements: research.getAllResearchStatements,
	getResearchStatementById: research.getResearchStatementById,
	createResearchStatement: research.createResearchStatement,
	updateResearchStatement: research.updateResearchStatement,
	deleteResearchStatement: research.deleteResearchStatement,
	updateResearchStatementEmbedding: research.updateResearchStatementEmbedding,
	// content features
	getActiveResearchStatements: contentFeatures.getActiveResearchStatements,
	getItemsMissingEmbeddingForStatement:
		contentFeatures.getItemsMissingEmbeddingForStatement,
	upsertContentFeaturesEmbedding:
		contentFeatures.upsertContentFeaturesEmbedding,
	getItemsMissingSimilarityForStatement:
		contentFeatures.getItemsMissingSimilarityForStatement,
	updateContentFeaturesSimilarityAndTier:
		contentFeatures.updateContentFeaturesSimilarityAndTier,
	// user ratings
	upsertUserRating: userRatings.upsertUserRating,
	getUserRatingStats: userRatings.getUserRatingStats,
	// favorites
	toggleFavorite: favorites.toggleFavorite,
	getFavoriteItems: favorites.getFavoriteItems,
	// helper: get item ids by source
	getItemIdsBySource: items.getItemIdsBySource,
};
