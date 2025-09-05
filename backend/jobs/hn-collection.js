const {
	discoverTopAndRecentWithMinScore,
} = require("../collectors/hackernews");
const { insertContentItems } = require("../database");
const AIService = require("../services/ai");

// Env-configurable limits with sensible defaults
const CONTENT_CHAR_LIMIT = Number(process.env.CONTENT_CHAR_LIMIT || 10000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 10000);
const FETCH_MAX_RETRIES = Number(process.env.FETCH_MAX_RETRIES || 1);
const DOMAIN_RATE_LIMIT_MS = Number(process.env.DOMAIN_RATE_LIMIT_MS || 500);
// Comma-separated list override; default allowed textual content types
const TEXT_CONTENT_TYPES = (
	process.env.TEXT_CONTENT_TYPES || "text/html,text/plain,application/xhtml+xml"
)
	.split(",")
	.map((s) => s.trim().toLowerCase())
	.filter(Boolean);

// Track last request time per hostname for simple rate limiting
const lastRequestMsByHost = new Map();

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostnameOf(url) {
	try {
		return new URL(url).hostname;
	} catch (_) {
		return null;
	}
}

async function rateLimitForDomain(url) {
	const host = hostnameOf(url);
	if (!host) return;
	const last = lastRequestMsByHost.get(host) || 0;
	const now = Date.now();
	const waitMs = last + DOMAIN_RATE_LIMIT_MS - now;
	if (waitMs > 0) {
		await sleep(waitMs);
	}
	lastRequestMsByHost.set(host, Date.now());
}

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

async function fetchWithTimeout(url, timeoutMs) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { "user-agent": "grist-mill-bot/0.1" },
		});
		return res;
	} finally {
		clearTimeout(t);
	}
}

function isAllowedTextContentType(contentTypeHeader) {
	const contentType = String(contentTypeHeader || "").toLowerCase();
	if (contentType.includes("multipart")) return false;
	// Allow generic text/* quickly
	if (contentType.startsWith("text/")) return true;
	return TEXT_CONTENT_TYPES.some((t) => contentType.includes(t));
}

async function fetchUrlTextContent(url) {
	for (let attempt = 0; attempt <= Math.max(0, FETCH_MAX_RETRIES); attempt++) {
		try {
			await rateLimitForDomain(url);
			const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
			if (!res || !res.ok) continue;
			const contentType = res.headers.get("content-type") || "";
			if (!isAllowedTextContentType(contentType)) return null;
			const body = await res.text();
			return extractReadableText(body);
		} catch (_) {
			// retry on next loop if allowed
		}
	}
	return null;
}

function extractReadableText(html) {
	if (!html || typeof html !== "string") return null;
	// Remove scripts/styles and tags; collapse whitespace
	const withoutScripts = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ");
	const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
	const collapsed = withoutTags.replace(/\s+/g, " ").trim();
	// Limit size
	return collapsed.slice(0, CONTENT_CHAR_LIMIT);
}

async function runHackerNewsCollection() {
	console.log(`[${new Date().toISOString()}] Starting HN collection job...`);

	try {
		const aiService = new AIService();
		console.log(
			`[${new Date().toISOString()}] About to call discoverAndHydrateHN...`
		);

		// Add timeout wrapper to prevent hanging
		const hydrated = await Promise.race([
			discoverTopAndRecentWithMinScore({ maxItems: 20, minPoints: 20 }),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("HN discovery timeout after 30 seconds")),
					30000
				)
			),
		]);

		console.log(
			`[${new Date().toISOString()}] HN collect: hydrated count: ${
				hydrated.length
			}`
		);

		const withTitleCount = hydrated.filter((it) => it?.firebase?.title).length;
		console.log(
			`[${new Date().toISOString()}] HN collect: items with title: ${withTitleCount}`
		);

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
				page_text: null,
			};

			// Populate page_text for all items
			try {
				if (typeof f.text === "string" && f.text.trim().length > 0) {
					item.page_text =
						extractReadableText(f.text) || f.text.slice(0, CONTENT_CHAR_LIMIT);
				} else if (item.url) {
					item.page_text = await fetchUrlTextContent(item.url);
				}
			} catch (_) {
				item.page_text = null;
			}

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

					// Only summarize highlighted items, using page_text when available
					if (item.highlight) {
						const contentToSummarize =
							item.page_text && item.page_text.trim().length > 0
								? item.page_text
								: null;
						if (contentToSummarize) {
							try {
								const summaryResult = await aiService.generateSummary(
									contentToSummarize,
									`Source: Hacker News; Title: ${f.title || ""}`
								);
								item.summary = summaryResult.summary;
							} catch (aiSummaryError) {
								console.warn(
									`[${new Date().toISOString()}] AI summary failed for item ${
										it.id
									}:`,
									aiSummaryError.message
								);
								item.summary = buildBasicHNSummary(f);
							}
						}
					}
					aiProcessedCount++;
				} catch (aiError) {
					console.warn(
						`[${new Date().toISOString()}] AI processing failed for item ${
							it.id
						}:`,
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
		console.log(
			`[${new Date().toISOString()}] HN collection completed: ${inserted} items inserted, ${aiProcessedCount} AI processed`
		);

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
