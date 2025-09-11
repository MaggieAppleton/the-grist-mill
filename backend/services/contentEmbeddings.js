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

module.exports = {
	extractContentText,
	generateEmbeddingForText,
};
