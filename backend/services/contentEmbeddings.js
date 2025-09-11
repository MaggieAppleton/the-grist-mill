const AIService = require("./ai");

function extractContentText(item) {
	try {
		const title = typeof item.title === "string" ? item.title.trim() : "";
		const summary = typeof item.summary === "string" ? item.summary.trim() : "";
		const pageText =
			typeof item.page_text === "string" ? item.page_text.trim() : "";
		let raw = "";
		try {
			if (typeof item.raw_content === "string") {
				// raw_content may already be JSON string or plain text
				raw = item.raw_content;
			} else if (item.raw_content) {
				raw = JSON.stringify(item.raw_content);
			}
		} catch (_) {
			raw = "";
		}
		const combined = [title, summary || pageText || raw]
			.filter((s) => typeof s === "string" && s.length > 0)
			.join("\n\n");
		// Truncate to a reasonable length for embeddings (first 500-1000 chars)
		const MAX_LEN = Number(process.env.EMBED_TEXT_MAX_CHARS || 1000);
		return combined.slice(0, MAX_LEN);
	} catch (_) {
		return "";
	}
}

async function generateEmbeddingForText(text) {
	const ai = new AIService();
	if (!ai.isAvailable()) {
		throw new Error("AI service not available - set OPENAI_API_KEY");
	}
	const { embedding } = await ai.embedText(text);
	return embedding;
}

// Safely parse an embedding payload that may be a JSON string, array, or null
function parseEmbeddingPayload(payload) {
	try {
		if (payload == null) return null;
		if (Array.isArray(payload)) return payload;
		if (typeof payload === "string") {
			const parsed = JSON.parse(payload);
			return Array.isArray(parsed) ? parsed : null;
		}
		// Some drivers may hand us Buffers; convert to string then parse
		if (Buffer.isBuffer(payload)) {
			const str = payload.toString("utf8");
			try {
				const parsed = JSON.parse(str);
				return Array.isArray(parsed) ? parsed : null;
			} catch (_) {
				return null;
			}
		}
		return null;
	} catch (_) {
		return null;
	}
}

// Compute cosine similarity between two numeric vectors
function cosineSimilarity(vectorA, vectorB) {
	if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) return 0;
	const len = Math.min(vectorA.length, vectorB.length);
	if (len === 0) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < len; i++) {
		const a = Number(vectorA[i]);
		const b = Number(vectorB[i]);
		if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
		dot += a * b;
		normA += a * a;
		normB += b * b;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	if (denom === 0) return 0;
	let sim = dot / denom;
	// Guard against tiny floating point drift
	if (sim > 1) sim = 1;
	if (sim < -1) sim = -1;
	return sim;
}

// Map similarity score to a 1-4 relevance tier using configurable thresholds
function determineRelevanceTier(similarityScore) {
	const t4 = Number(process.env.SIM_TIER4_MIN || 0.8); // Very Relevant
	const t3 = Number(process.env.SIM_TIER3_MIN || 0.65); // Relevant
	const t2 = Number(process.env.SIM_TIER2_MIN || 0.5); // Weakly Relevant
	const s = Number(similarityScore || 0);
	if (s >= t4) return 4;
	if (s >= t3) return 3;
	if (s >= t2) return 2;
	return 1; // Not Relevant
}

module.exports = {
	extractContentText,
	generateEmbeddingForText,
	parseEmbeddingPayload,
	cosineSimilarity,
	determineRelevanceTier,
};
