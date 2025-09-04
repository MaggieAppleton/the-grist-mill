const { discoverAndHydrateHN } = require("../collectors/hackernews");
const { insertContentItems } = require("../database");
const AIService = require("../services/ai");

// Minimal HTML to text extraction for summarization
function buildBasicHNSummary(item) {
	const title = item?.title ? String(item.title).trim() : "Untitled";
	const score = Number.isFinite(item?.score) ? item.score : null;
	const by = item?.by ? String(item.by).trim() : null;
	const parts = [title];
	const meta = [];
	if (Number.isFinite(score)) meta.push(`${score} points`);
	if (by) meta.push(`by ${by}`);
	if (meta.length) parts.push(`— ${meta.join(" ")}`);
	return parts.join(" ");
}

async function fetchUrlTextContent(url) {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const contentType = res.headers.get("content-type") || "";
		if (!contentType.includes("text")) return null;
		const body = await res.text();
		return extractReadableText(body);
	} catch {
		return null;
	}
}

function extractReadableText(html) {
	if (!html || typeof html !== "string") return null;
	// Remove scripts/styles and tags; collapse whitespace
	const withoutScripts = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ");
	const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
	const collapsed = withoutTags.replace(/\s+/g, " ").trim();
	// Limit size to avoid very long prompts
	return collapsed.slice(0, 20000);
}

async function runHackerNewsCollection() {
	console.log(`[${new Date().toISOString()}] Starting HN collection job...`);
	
	try {
		const aiService = new AIService();
		console.log(`[${new Date().toISOString()}] About to call discoverAndHydrateHN...`);
		
		// Add timeout wrapper to prevent hanging
		const hydrated = await Promise.race([
			discoverAndHydrateHN({ maxItems: 20 }),
			new Promise((_, reject) => 
				setTimeout(() => reject(new Error('HN discovery timeout after 30 seconds')), 30000)
			)
		]);
		
		console.log(`[${new Date().toISOString()}] HN collect: hydrated count: ${hydrated.length}`);
		
		const withTitleCount = hydrated.filter((it) => it?.firebase?.title).length;
		console.log(`[${new Date().toISOString()}] HN collect: items with title: ${withTitleCount}`);

		const items = [];
		let processedCount = 0;
		let aiProcessedCount = 0;

		for (const it of hydrated) {
			const f = it.firebase || {};

			// Basic item structure
			const item = {
				source_type: "hackernews",
				source_id: String(it.id),
				title: f.title || null,
				summary: null,
				raw_content: JSON.stringify({
					firebase: f,
					algolia: it.algolia || null,
				}),
				url:
					f.url ||
					(f.id ? `https://news.ycombinator.com/item?id=${f.id}` : null),
				highlight: false,
			};

			// Try AI processing if available
			if (aiService.isAvailable() && f.title) {
				try {
					const aiResult = await aiService.processHackerNewsItem(f);
					item.highlight = aiResult.highlight;
					// Add AI metadata to raw_content
					const rawContent = JSON.parse(item.raw_content);
					rawContent.ai_processing = {
						relevance_score: aiResult.relevance_score,
						relevance_explanation: aiResult.relevance_explanation,
						usage: aiResult.usage,
					};
					item.raw_content = JSON.stringify(rawContent);

					// Only fetch and summarize content for highlighted items
					if (item.highlight) {
						let contentToSummarize = null;
						if (typeof f.text === "string" && f.text.trim().length > 0) {
							contentToSummarize = extractReadableText(f.text) || f.text;
						} else if (item.url) {
							contentToSummarize = await fetchUrlTextContent(item.url);
						}
						if (contentToSummarize && contentToSummarize.trim().length > 0) {
							try {
								const summaryResult = await aiService.generateSummary(
									contentToSummarize,
									`Source: Hacker News; Title: ${f.title || ""}`
								);
								item.summary = summaryResult.summary;
							} catch (aiSummaryError) {
								console.warn(
									`[${new Date().toISOString()}] AI summary failed for item ${it.id}:`,
									aiSummaryError.message
								);
								item.summary = buildBasicHNSummary(f);
							}
						}
					}
					aiProcessedCount++;
				} catch (aiError) {
					console.warn(
						`[${new Date().toISOString()}] AI processing failed for item ${it.id}:`,
						aiError.message
					);
					// Fall back to a basic, non-fabricated summary
					item.summary = buildBasicHNSummary(f);
				}
			} else {
				// AI not available; do not fabricate summaries from titles
			}

			items.push(item);
			processedCount++;
		}

		const inserted = await insertContentItems(items);
		console.log(`[${new Date().toISOString()}] HN collection completed: ${inserted} items inserted, ${aiProcessedCount} AI processed`);
		
		return {
			success: true,
			inserted,
			processed: processedCount,
			ai_processed: aiProcessedCount,
			ai_available: aiService.isAvailable(),
		};
	} catch (error) {
		console.error(`[${new Date().toISOString()}] HN collection failed:`, error);
		return {
			success: false,
			error: error.message,
		};
	}
}

module.exports = { runHackerNewsCollection };