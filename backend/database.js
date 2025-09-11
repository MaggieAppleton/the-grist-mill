const { db } = require("./db/connection");
const items = require("./db/items");
const aiUsage = require("./db/aiUsage");
const research = require("./db/researchStatements");
const contentFeatures = require("./db/contentFeatures");
const userRatings = require("./db/userRatings");
const { initializeDatabase: initializeDatabaseImpl } = require("./db/schema");

// Initialize database tables
function initializeDatabase() {
	// moved to ./db/schema.js
}

// Insert sample data
function insertSampleData() {
	return new Promise((resolve, reject) => {
		const sampleItem = {
			source_type: "discord",
			source_id: "sample_001",
			title: "Sample Discord Activity",
			summary:
				"This is a sample content item from Discord showing 3 messages about web development and project updates.",
			raw_content: JSON.stringify({
				server_name: "Dev Community",
				channels: ["general", "projects"],
				message_count: 3,
				messages: [
					{
						channel: "general",
						content: "Anyone working with React 18 hooks?",
						author: "developer1",
					},
					{
						channel: "projects",
						content: "Just deployed my portfolio site!",
						author: "designer2",
					},
					{
						channel: "general",
						content: "Great tutorial on async/await patterns",
						author: "coder3",
					},
				],
			}),
			url: null,
		};

		const insertQuery = `
      INSERT OR IGNORE INTO content_items (source_type, source_id, title, summary, raw_content, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

		db.run(
			insertQuery,
			[
				sampleItem.source_type,
				sampleItem.source_id,
				sampleItem.title,
				sampleItem.summary,
				sampleItem.raw_content,
				sampleItem.url,
			],
			function (err) {
				if (err) {
					console.error("Error inserting sample data:", err.message);
					reject(err);
				} else {
					console.log("Sample data inserted with ID:", this.lastID);
					resolve(this.lastID);
				}
			}
		);
	});
}

// Get all content items
function getAllItems() {
	// moved to ./db/items.js
}

// Get items with optional filtering and pagination
function getItemsFiltered({ source, limit = 50, offset = 0 } = {}) {
	// moved to ./db/items.js
}

// Search items by query string across title, summary, and raw content
function searchItems({ query, source, limit = 50, offset = 0 } = {}) {
	// moved to ./db/items.js
}

// Insert a single content item (ignores duplicates by UNIQUE constraint)
function insertContentItem(item) {
	// moved to ./db/items.js
}

// Bulk insert content items in a transaction
function insertContentItems(items) {
	// moved to ./db/items.js
}

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

// Get AI usage totals for a specific date (YYYY-MM-DD)
function getAiUsageForDate(dateStr) {
	// moved to ./db/aiUsage.js
}

// Get today's AI usage totals
function getTodayAiUsage() {
	// moved to ./db/aiUsage.js
}

// Increment AI usage counters for today by the provided amounts
function incrementAiUsage({
	tokensUsed = 0,
	estimatedCost = 0,
	requestsCount = 1,
} = {}) {
	// moved to ./db/aiUsage.js
}

// Research statements helpers
function getAllResearchStatements() {
	// moved to ./db/researchStatements.js
}

function getResearchStatementById(id) {
	// moved to ./db/researchStatements.js
}

function createResearchStatement({
	name,
	statement,
	keywords,
	negative_keywords,
	is_active = true,
}) {
	// moved to ./db/researchStatements.js
}

function updateResearchStatement(
	id,
	{ name, statement, keywords, negative_keywords, is_active }
) {
	// moved to ./db/researchStatements.js
}

function deleteResearchStatement(id) {
	// moved to ./db/researchStatements.js
}

function updateResearchStatementEmbedding(id, embeddingVector) {
	// moved to ./db/researchStatements.js
}

// Content features helpers (embeddings per item per statement)
function getActiveResearchStatements() {
	// moved to ./db/contentFeatures.js
}

function getItemsMissingEmbeddingForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	// moved to ./db/contentFeatures.js
}

function upsertContentFeaturesEmbedding(
	contentItemId,
	researchStatementId,
	embeddingVector
) {
	// moved to ./db/contentFeatures.js
}

function getItemsMissingSimilarityForStatement(
	researchStatementId,
	{ limit = 100 } = {}
) {
	// moved to ./db/contentFeatures.js
}

function updateContentFeaturesSimilarityAndTier(
	contentItemId,
	researchStatementId,
	similarityScore,
	relevanceTier
) {
	// moved to ./db/contentFeatures.js
}

// User ratings helpers
function upsertUserRating(contentItemId, researchStatementId, rating) {
	// moved to ./db/userRatings.js
}

function getUserRatingStats({ researchStatementId } = {}) {
	// moved to ./db/userRatings.js
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
	insertSampleData,
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
	// helper: get item ids by source
	getItemIdsBySource: items.getItemIdsBySource,
};
