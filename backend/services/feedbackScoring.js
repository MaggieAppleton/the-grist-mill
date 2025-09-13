const {
	parseEmbeddingPayload,
	cosineSimilarity,
} = require("./contentEmbeddings");

/**
 * Compute a feedback-based score for a content item based on similarity to previously rated items.
 * 
 * Algorithm:
 * 1. Find all rated items for the research statement
 * 2. Compute embedding similarity between target item and each rated item
 * 3. Weight each rating by similarity distance (higher similarity = higher weight)
 * 4. Apply exponential decay to similarity weights to focus on most similar items
 * 5. Return weighted average of ratings, normalized to 0-1 scale
 *
 * @param {Array} targetEmbedding - Embedding vector for the item to score
 * @param {Array} ratedItems - Array of {content_item_id, rating, content_embedding} objects
 * @param {Object} options - Configuration options
 * @returns {number} Feedback score between 0 and 1
 */
function computeFeedbackScore(targetEmbedding, ratedItems, options = {}) {
	const {
		minSimilarityThreshold = 0.1, // Ignore items below this similarity
		similarityDecayFactor = 2.0,  // Exponential decay factor for similarity weights
		maxSimilarItems = 50,         // Limit number of similar items to consider
	} = options;

	if (!Array.isArray(targetEmbedding) || targetEmbedding.length === 0) {
		return 0;
	}

	if (!Array.isArray(ratedItems) || ratedItems.length === 0) {
		return 0; // No feedback data available
	}

	const similarities = [];

	// Calculate similarity to each rated item
	for (const ratedItem of ratedItems) {
		try {
			const ratedEmbedding = parseEmbeddingPayload(ratedItem.content_embedding);
			if (!Array.isArray(ratedEmbedding) || ratedEmbedding.length === 0) {
				continue;
			}

			const similarity = cosineSimilarity(targetEmbedding, ratedEmbedding);
			
			// Only consider items above minimum similarity threshold
			if (similarity >= minSimilarityThreshold) {
				similarities.push({
					similarity,
					rating: Number(ratedItem.rating) || 1,
					contentItemId: ratedItem.content_item_id,
				});
			}
		} catch (err) {
			// Skip items with invalid embeddings
			continue;
		}
	}

	if (similarities.length === 0) {
		return 0; // No similar items found
	}

	// Sort by similarity (descending) and take top N
	similarities.sort((a, b) => b.similarity - a.similarity);
	const topSimilarities = similarities.slice(0, maxSimilarItems);

	// Compute weighted score using exponential decay
	let weightedSum = 0;
	let totalWeight = 0;

	for (const item of topSimilarities) {
		// Apply exponential decay to similarity weight
		// Higher decay factor = more focus on most similar items
		const weight = Math.pow(item.similarity, similarityDecayFactor);
		
		// Convert rating (1-4) to normalized score (0-1)
		const normalizedRating = (item.rating - 1) / 3.0;
		
		weightedSum += normalizedRating * weight;
		totalWeight += weight;
	}

	if (totalWeight === 0) {
		return 0;
	}

	const feedbackScore = weightedSum / totalWeight;
	
	// Ensure score is in [0, 1] range
	return Math.max(0, Math.min(1, feedbackScore));
}

/**
 * Batch compute feedback scores for multiple items against a set of rated items
 * 
 * @param {Array} targetItems - Items to score, each with {content_item_id, research_statement_id, content_embedding}
 * @param {Array} ratedItems - Rated items for comparison
 * @param {Object} options - Configuration options
 * @returns {Array} Array of {content_item_id, research_statement_id, feedback_score} objects
 */
function batchComputeFeedbackScores(targetItems, ratedItems, options = {}) {
	const results = [];

	if (!Array.isArray(ratedItems) || ratedItems.length === 0) {
		// No ratings available - return zero scores
		return targetItems.map(item => ({
			content_item_id: item.content_item_id,
			research_statement_id: item.research_statement_id,
			feedback_score: 0,
		}));
	}

	for (const targetItem of targetItems) {
		try {
			const targetEmbedding = parseEmbeddingPayload(targetItem.content_embedding);
			const feedbackScore = computeFeedbackScore(targetEmbedding, ratedItems, options);
			
			results.push({
				content_item_id: targetItem.content_item_id,
				research_statement_id: targetItem.research_statement_id,
				feedback_score: feedbackScore,
			});
		} catch (err) {
			console.warn(
				`Failed to compute feedback score for item ${targetItem.content_item_id}:`,
				err.message
			);
			// Default to zero score on error
			results.push({
				content_item_id: targetItem.content_item_id,
				research_statement_id: targetItem.research_statement_id,
				feedback_score: 0,
			});
		}
	}

	return results;
}

/**
 * Get statistics about feedback scoring for debugging/monitoring
 * 
 * @param {Array} ratedItems - Array of rated items
 * @returns {Object} Statistics object
 */
function getFeedbackScoringStats(ratedItems) {
	if (!Array.isArray(ratedItems)) {
		return { available: false };
	}

	const totalRated = ratedItems.length;
	const ratingDistribution = {
		1: 0, // Not Relevant
		2: 0, // Weakly Relevant  
		3: 0, // Relevant
		4: 0, // Very Relevant
	};

	for (const item of ratedItems) {
		const rating = Number(item.rating) || 1;
		if (ratingDistribution.hasOwnProperty(rating)) {
			ratingDistribution[rating]++;
		}
	}

	return {
		available: totalRated > 0,
		totalRated,
		ratingDistribution,
		averageRating: totalRated > 0 
			? ratedItems.reduce((sum, item) => sum + (Number(item.rating) || 1), 0) / totalRated 
			: 0,
	};
}

module.exports = {
	computeFeedbackScore,
	batchComputeFeedbackScores,
	getFeedbackScoringStats,
};