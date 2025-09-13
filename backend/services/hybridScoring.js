/**
 * Hybrid scoring service that combines keyword, similarity, and feedback scores
 *
 * Implements the weighted scoring formula:
 * Final Score = (weight_keyword × keyword_score) + (weight_similarity × similarity_score) + (weight_feedback × feedback_score)
 *
 * Default weights: keyword=0.3, similarity=0.4, feedback=0.3
 */

const { determineRelevanceTier } = require("./contentEmbeddings");

/**
 * Get scoring weights from environment variables with fallbacks
 * @returns {Object} Scoring weights configuration
 */
function getScoringWeights() {
	return {
		keyword: Number(process.env.SCORE_WEIGHT_KEYWORD || 0.3),
		similarity: Number(process.env.SCORE_WEIGHT_SIMILARITY || 0.4),
		feedback: Number(process.env.SCORE_WEIGHT_FEEDBACK || 0.3),
		// Minimum scores to consider valid
		minKeywordScore: Number(process.env.MIN_KEYWORD_SCORE || 0.0),
		minSimilarityScore: Number(process.env.MIN_SIMILARITY_SCORE || 0.0),
		minFeedbackScore: Number(process.env.MIN_FEEDBACK_SCORE || 0.0),
	};
}

/**
 * Validate and normalize individual score components
 * @param {number} score - Raw score value
 * @param {number} minScore - Minimum valid score
 * @param {number} defaultScore - Default if invalid
 * @returns {number} Normalized score between 0 and 1
 */
function normalizeScore(score, minScore = 0.0, defaultScore = 0.0) {
	const numScore = Number(score);
	if (!Number.isFinite(numScore)) {
		return defaultScore;
	}

	// Ensure score is within [0, 1] range
	const clamped = Math.max(0, Math.min(1, numScore));

	// Apply minimum threshold
	return clamped >= minScore ? clamped : defaultScore;
}

/**
 * Calculate hybrid final score using weighted combination
 * @param {Object} scores - Individual score components
 * @param {number} scores.keywordScore - Keyword matching score (0-1)
 * @param {number} scores.similarityScore - Embedding similarity score (0-1)
 * @param {number} scores.feedbackScore - Feedback-based score (0-1)
 * @param {Object} options - Scoring configuration options
 * @returns {Object} Final score and metadata
 */
function calculateHybridScore(scores, options = {}) {
	const weights = getScoringWeights();
	const { keywordScore = 0, similarityScore = 0, feedbackScore = 0 } = scores;

	// Normalize individual scores
	const normalizedKeyword = normalizeScore(
		keywordScore,
		weights.minKeywordScore,
		0
	);
	const normalizedSimilarity = normalizeScore(
		similarityScore,
		weights.minSimilarityScore,
		0
	);
	const normalizedFeedback = normalizeScore(
		feedbackScore,
		weights.minFeedbackScore,
		0
	);

	// Calculate weighted final score
	const finalScore =
		weights.keyword * normalizedKeyword +
		weights.similarity * normalizedSimilarity +
		weights.feedback * normalizedFeedback;

	// Ensure final score is in valid range
	const clampedFinalScore = Math.max(0, Math.min(1, finalScore));

	// Determine relevance tier based on final score
	const relevanceTier = determineRelevanceTierFromFinalScore(clampedFinalScore);

	return {
		finalScore: clampedFinalScore,
		relevanceTier,
		components: {
			keyword: normalizedKeyword,
			similarity: normalizedSimilarity,
			feedback: normalizedFeedback,
		},
		weights: {
			keyword: weights.keyword,
			similarity: weights.similarity,
			feedback: weights.feedback,
		},
		metadata: {
			hasKeywordData: normalizedKeyword > 0,
			hasSimilarityData: normalizedSimilarity > 0,
			hasFeedbackData: normalizedFeedback > 0,
		},
	};
}

/**
 * Determine relevance tier from final hybrid score
 * Uses different thresholds than similarity-only scoring since this combines multiple signals
 * @param {number} finalScore - Final hybrid score (0-1)
 * @returns {number} Relevance tier (1-4)
 */
function determineRelevanceTierFromFinalScore(finalScore) {
	// Hybrid scoring tiers - slightly lower thresholds since we're combining signals
	const t4 = Number(process.env.HYBRID_TIER4_MIN || 0.75); // Very Relevant
	const t3 = Number(process.env.HYBRID_TIER3_MIN || 0.6); // Relevant
	const t2 = Number(process.env.HYBRID_TIER2_MIN || 0.45); // Weakly Relevant

	const score = Number(finalScore) || 0;
	if (score >= t4) return 4;
	if (score >= t3) return 3;
	if (score >= t2) return 2;
	return 1; // Not Relevant
}

/**
 * Batch calculate hybrid scores for multiple content features
 * @param {Array} contentFeatures - Array of content_features records
 * @param {Object} options - Scoring options
 * @returns {Array} Array of scoring results
 */
function batchCalculateHybridScores(contentFeatures, options = {}) {
	if (!Array.isArray(contentFeatures)) {
		return [];
	}

	const results = [];

	for (const feature of contentFeatures) {
		try {
			const scores = {
				keywordScore: feature.keyword_score,
				similarityScore: feature.similarity_score,
				feedbackScore: feature.feedback_score,
			};

			const hybridResult = calculateHybridScore(scores, options);

			results.push({
				content_item_id: feature.content_item_id,
				research_statement_id: feature.research_statement_id,
				...hybridResult,
			});
		} catch (error) {
			console.warn(
				`Failed to calculate hybrid score for item ${feature.content_item_id}:`,
				error
			);
			// Return minimal result on error
			results.push({
				content_item_id: feature.content_item_id,
				research_statement_id: feature.research_statement_id,
				finalScore: 0,
				relevanceTier: 1,
				components: { keyword: 0, similarity: 0, feedback: 0 },
				weights: getScoringWeights(),
				metadata: {
					hasKeywordData: false,
					hasSimilarityData: false,
					hasFeedbackData: false,
				},
			});
		}
	}

	return results;
}

/**
 * Get scoring configuration for debugging/monitoring
 * @returns {Object} Current scoring configuration
 */
function getScoringConfiguration() {
	const weights = getScoringWeights();

	return {
		weights,
		thresholds: {
			tier4: Number(process.env.HYBRID_TIER4_MIN || 0.75),
			tier3: Number(process.env.HYBRID_TIER3_MIN || 0.6),
			tier2: Number(process.env.HYBRID_TIER2_MIN || 0.45),
			tier1: 0.0,
		},
		validation: {
			weightsSum: weights.keyword + weights.similarity + weights.feedback,
			isBalanced:
				Math.abs(
					weights.keyword + weights.similarity + weights.feedback - 1.0
				) < 0.001,
		},
	};
}

/**
 * Calculate score statistics for monitoring/debugging
 * @param {Array} hybridResults - Array of hybrid scoring results
 * @returns {Object} Statistics summary
 */
function getHybridScoringStats(hybridResults) {
	if (!Array.isArray(hybridResults) || hybridResults.length === 0) {
		return {
			available: false,
			count: 0,
			scoreDistribution: {},
			tierDistribution: {},
			componentStats: {},
		};
	}

	const scores = hybridResults.map((r) => r.finalScore || 0);
	const tiers = hybridResults.map((r) => r.relevanceTier || 1);

	// Score distribution
	const scoreBuckets = {
		"0.0-0.2": 0,
		"0.2-0.4": 0,
		"0.4-0.6": 0,
		"0.6-0.8": 0,
		"0.8-1.0": 0,
	};

	for (const score of scores) {
		if (score < 0.2) scoreBuckets["0.0-0.2"]++;
		else if (score < 0.4) scoreBuckets["0.2-0.4"]++;
		else if (score < 0.6) scoreBuckets["0.4-0.6"]++;
		else if (score < 0.8) scoreBuckets["0.6-0.8"]++;
		else scoreBuckets["0.8-1.0"]++;
	}

	// Tier distribution
	const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
	for (const tier of tiers) {
		if (tierCounts.hasOwnProperty(tier)) {
			tierCounts[tier]++;
		}
	}

	// Component statistics
	const components = ["keyword", "similarity", "feedback"];
	const componentStats = {};

	for (const component of components) {
		const values = hybridResults
			.map((r) => r.components?.[component] || 0)
			.filter((v) => Number.isFinite(v));

		if (values.length > 0) {
			componentStats[component] = {
				count: values.length,
				average: values.reduce((a, b) => a + b, 0) / values.length,
				min: Math.min(...values),
				max: Math.max(...values),
			};
		}
	}

	return {
		available: true,
		count: hybridResults.length,
		scoreDistribution: scoreBuckets,
		tierDistribution: tierCounts,
		componentStats,
		overall: {
			averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
			minScore: Math.min(...scores),
			maxScore: Math.max(...scores),
		},
	};
}

module.exports = {
	calculateHybridScore,
	batchCalculateHybridScores,
	determineRelevanceTierFromFinalScore,
	getScoringWeights,
	getScoringConfiguration,
	getHybridScoringStats,
};
