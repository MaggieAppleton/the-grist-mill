/**
 * Keyword scoring service for content items based on research statement keywords
 *
 * Implements keyword matching with positive and negative keywords to generate
 * a normalized score between 0 and 1.
 */

/**
 * Extract text content from a content item for keyword matching
 * @param {Object} item - Content item with title, summary, page_text, etc.
 * @returns {string} Combined text for keyword matching
 */
function extractKeywordText(item) {
	try {
		const title = typeof item.title === "string" ? item.title.trim() : "";
		const summary = typeof item.summary === "string" ? item.summary.trim() : "";
		const pageText =
			typeof item.page_text === "string" ? item.page_text.trim() : "";

		// For keyword matching, we want more content than embeddings
		// Include more of the page text if available
		const combinedText = [title, summary, pageText]
			.filter((text) => text && text.length > 0)
			.join(" ")
			.toLowerCase(); // Case insensitive matching

		return combinedText;
	} catch (error) {
		console.warn("Error extracting keyword text from item:", error);
		return "";
	}
}

/**
 * Parse keywords from JSON string with validation
 * @param {string|null} keywordsJson - JSON array of keywords
 * @returns {Array<string>} Array of lowercase keywords
 */
function parseKeywords(keywordsJson) {
	try {
		if (!keywordsJson || typeof keywordsJson !== "string") {
			return [];
		}

		const parsed = JSON.parse(keywordsJson);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.filter(
				(keyword) => typeof keyword === "string" && keyword.trim().length > 0
			)
			.map((keyword) => keyword.trim().toLowerCase());
	} catch (error) {
		console.warn("Error parsing keywords:", error);
		return [];
	}
}

/**
 * Calculate keyword match score for a single keyword against text
 * Uses different weights for title vs content matches
 * @param {string} keyword - Keyword to search for
 * @param {string} title - Title text (lowercase)
 * @param {string} content - Full content text (lowercase)
 * @returns {number} Match score for this keyword
 */
function calculateKeywordMatchScore(keyword, title, content) {
	if (!keyword || keyword.length === 0) {
		return 0;
	}

	let score = 0;

	// Title matches are weighted more heavily
	const titleMatches = (
		title.match(new RegExp(escapeRegex(keyword), "gi")) || []
	).length;
	const contentMatches = (
		content.match(new RegExp(escapeRegex(keyword), "gi")) || []
	).length;

	// Weight title matches higher than content matches
	score += titleMatches * 2.0; // Title match = 2 points
	score += contentMatches * 0.5; // Content match = 0.5 points

	// Apply logarithmic scaling to diminish returns from many matches
	if (score > 0) {
		score = Math.log(1 + score);
	}

	return score;
}

/**
 * Escape special regex characters in keyword
 * @param {string} keyword - Keyword to escape
 * @returns {string} Escaped keyword safe for regex
 */
function escapeRegex(keyword) {
	return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculate keyword score for content item against research statement
 * @param {Object} item - Content item to score
 * @param {Object} researchStatement - Research statement with keywords
 * @param {Object} options - Scoring options
 * @returns {number} Keyword score between 0 and 1
 */
function calculateKeywordScore(item, researchStatement, options = {}) {
	const {
		maxKeywordScore = 10.0, // Maximum raw score before normalization
		negativePenalty = 0.5, // Penalty multiplier for negative keyword matches
	} = options;

	try {
		// Extract and normalize text
		const text = extractKeywordText(item);
		if (!text || text.length === 0) {
			return 0;
		}

		// Split title from rest for weighted scoring
		const title =
			typeof item.title === "string" ? item.title.toLowerCase() : "";

		// Parse keywords
		const positiveKeywords = parseKeywords(researchStatement.keywords);
		const negativeKeywords = parseKeywords(researchStatement.negative_keywords);

		if (positiveKeywords.length === 0) {
			// No keywords defined - return neutral score
			return 0.5;
		}

		let positiveScore = 0;
		let negativeScore = 0;

		// Calculate positive keyword scores
		for (const keyword of positiveKeywords) {
			positiveScore += calculateKeywordMatchScore(keyword, title, text);
		}

		// Calculate negative keyword penalties
		for (const keyword of negativeKeywords) {
			negativeScore += calculateKeywordMatchScore(keyword, title, text);
		}

		// Apply negative penalty
		const finalScore = Math.max(
			0,
			positiveScore - negativeScore * negativePenalty
		);

		// Normalize to 0-1 scale using sigmoid-like function
		const normalized = finalScore / (finalScore + maxKeywordScore);

		return Math.max(0, Math.min(1, normalized));
	} catch (error) {
		console.warn(`Error calculating keyword score for item ${item.id}:`, error);
		return 0;
	}
}

/**
 * Batch calculate keyword scores for multiple items against research statement
 * @param {Array} items - Content items to score
 * @param {Object} researchStatement - Research statement with keywords
 * @param {Object} options - Scoring options
 * @returns {Array} Array of {content_item_id, research_statement_id, keyword_score} objects
 */
function batchCalculateKeywordScores(items, researchStatement, options = {}) {
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}

	if (!researchStatement || !researchStatement.id) {
		console.warn(
			"Invalid research statement provided to batchCalculateKeywordScores"
		);
		return items.map((item) => ({
			content_item_id: item.id,
			research_statement_id: null,
			keyword_score: 0,
		}));
	}

	const results = [];

	for (const item of items) {
		try {
			const keywordScore = calculateKeywordScore(
				item,
				researchStatement,
				options
			);

			results.push({
				content_item_id: item.id,
				research_statement_id: researchStatement.id,
				keyword_score: keywordScore,
			});
		} catch (error) {
			console.warn(
				`Failed to calculate keyword score for item ${item.id}:`,
				error
			);
			results.push({
				content_item_id: item.id,
				research_statement_id: researchStatement.id,
				keyword_score: 0,
			});
		}
	}

	return results;
}

/**
 * Get statistics about keyword scoring for debugging/monitoring
 * @param {Array} scores - Array of keyword scores
 * @returns {Object} Statistics object
 */
function getKeywordScoringStats(scores) {
	if (!Array.isArray(scores) || scores.length === 0) {
		return {
			available: false,
			count: 0,
			average: 0,
			min: 0,
			max: 0,
			distribution: {},
		};
	}

	const values = scores.map((s) => Number(s.keyword_score) || 0);
	const sum = values.reduce((a, b) => a + b, 0);
	const average = sum / values.length;
	const min = Math.min(...values);
	const max = Math.max(...values);

	// Create distribution buckets
	const buckets = {
		"0.0-0.2": 0,
		"0.2-0.4": 0,
		"0.4-0.6": 0,
		"0.6-0.8": 0,
		"0.8-1.0": 0,
	};

	for (const value of values) {
		if (value < 0.2) buckets["0.0-0.2"]++;
		else if (value < 0.4) buckets["0.2-0.4"]++;
		else if (value < 0.6) buckets["0.4-0.6"]++;
		else if (value < 0.8) buckets["0.6-0.8"]++;
		else buckets["0.8-1.0"]++;
	}

	return {
		available: true,
		count: values.length,
		average,
		min,
		max,
		distribution: buckets,
	};
}

module.exports = {
	calculateKeywordScore,
	batchCalculateKeywordScores,
	getKeywordScoringStats,
	extractKeywordText,
	parseKeywords,
	// Export for testing
	calculateKeywordMatchScore,
	escapeRegex,
};
