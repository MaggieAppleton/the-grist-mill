export function getRelevanceScore(item) {
	try {
		if (!item || !item.raw_content) return null;
		const raw =
			typeof item.raw_content === "string"
				? JSON.parse(item.raw_content)
				: item.raw_content;
		const score = raw?.ai_processing?.relevance_score;
		return typeof score === "number" ? score : null;
	} catch {
		return null;
	}
}

export function getRelevanceExplanation(item) {
	try {
		if (!item || !item.raw_content) return null;
		const raw =
			typeof item.raw_content === "string"
				? JSON.parse(item.raw_content)
				: item.raw_content;
		const exp = raw?.ai_processing?.relevance_explanation;
		return typeof exp === "string" && exp.trim().length > 0 ? exp : null;
	} catch {
		return null;
	}
}

export function getHNCommentsUrl(item) {
	return item && typeof item.comments_url === "string" && item.comments_url
		? item.comments_url
		: null;
}
