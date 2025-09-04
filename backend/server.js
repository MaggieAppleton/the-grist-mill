// Load environment variables
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const { discoverAndHydrateHN } = require("./collectors/hackernews");
const {
	initializeDatabase,
	insertSampleData,
	getAllItems,
	getItemsFiltered,
	insertContentItems,
} = require("./database");
const AIService = require("./services/ai");
const app = express();
const PORT = process.env.PORT || 3001;

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

// Middleware
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
	res.json({ message: "The Grist Mill Backend is running!" });
});

// API Routes
app.get("/api/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		service: "The Grist Mill Backend",
	});
});

app.get("/api/items", async (req, res) => {
	try {
		const { source, limit, offset } = req.query;
		if (source || limit || offset) {
			const items = await getItemsFiltered({ source, limit, offset });
			return res.json(items);
		}
		const items = await getAllItems();
		res.json(items);
	} catch (error) {
		console.error("Error fetching items:", error);
		res.status(500).json({ error: "Failed to fetch items" });
	}
});

// Manual Hacker News collection trigger
app.post("/api/collectors/hackernews", async (req, res) => {
	try {
		const aiService = new AIService();
		const hydrated = await discoverAndHydrateHN({ maxItems: 20 });
		console.log("HN collect: hydrated count:", hydrated.length);
		const withTitleCount = hydrated.filter((it) => it?.firebase?.title).length;
		console.log("HN collect: items with title:", withTitleCount);

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
									`AI summary failed for item ${it.id}:`,
									aiSummaryError.message
								);
								item.summary = buildBasicHNSummary(f);
							}
						}
					}
					aiProcessedCount++;
				} catch (aiError) {
					console.warn(
						`AI processing failed for item ${it.id}:`,
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
		res.json({
			status: "ok",
			inserted,
			processed: processedCount,
			ai_processed: aiProcessedCount,
			ai_available: aiService.isAvailable(),
		});
	} catch (error) {
		console.error("HN manual collect failed:", error);
		res.status(500).json({ error: "Failed to collect Hacker News" });
	}
});

// AI service test endpoint
app.get("/api/ai/test", async (req, res) => {
	try {
		const aiService = new AIService();

		if (!aiService.isAvailable()) {
			return res.status(503).json({
				error: "AI service not available",
				message: "OPENAI_API_KEY environment variable not set",
			});
		}

		const result = await aiService.testConnection();
		res.json({
			status: "success",
			message: result.message,
			usage: result.usage,
			ai_available: true,
		});
	} catch (error) {
		console.error("AI test failed:", error);
		res.status(500).json({
			error: "AI test failed",
			message: error.message,
			ai_available: false,
		});
	}
});

// Initialize database and start server
async function startServer() {
	try {
		await initializeDatabase();
		console.log("Database initialized successfully");

		// Removed legacy sample data insertion

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to initialize database:", error);
		process.exit(1);
	}
}

startServer();
