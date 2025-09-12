// Load environment variables
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const rateLimit = require("express-rate-limit");
const {
	initializeDatabase,
	getAllItems,
	getItemsFiltered,
	searchItems,
	insertContentItems,
	getTodayAiUsage,
	// research statement helpers
	getAllResearchStatements,
	getResearchStatementById,
	createResearchStatement,
	updateResearchStatement,
	deleteResearchStatement,
	updateResearchStatementEmbedding,
	// user ratings
	upsertUserRating,
	getUserRatingStats,
	// favorites
	toggleFavorite,
	getFavoriteItems,
} = require("./database");
const AIService = require("./services/ai");
const { initializeScheduler } = require("./jobs/scheduler");
const { runHackerNewsCollection } = require("./jobs/hn-collection");
const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting middleware
const generalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: {
		error: "Too many requests from this IP, please try again later.",
		retryAfter: "15 minutes",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

const strictLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // limit each IP to 10 requests per windowMs
	message: {
		error: "Too many requests for this resource, please try again later.",
		retryAfter: "15 minutes",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

const healthLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 200,
	message: {
		error: "Too many health check requests, please try again later.",
		retryAfter: "15 minutes",
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// Middleware
app.use(express.json());

// Basic route
app.get("/", (req, res) => {
	res.json({ message: "The Grist Mill Backend is running!" });
});

// API Routes
app.get("/api/health", healthLimiter, (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		service: "The Grist Mill Backend",
	});
});

// Helper to derive Hacker News comments URL for items
function getHNCommentsUrl(item) {
	try {
		if (!item || item.source_type !== "hackernews") return null;
		const id = item.source_id;
		if (!id) return null;
		return `https://news.ycombinator.com/item?id=${encodeURIComponent(
			String(id)
		)}`;
	} catch (_) {
		return null;
	}
}

app.get("/api/items", generalLimiter, async (req, res) => {
	try {
		const { source, limit, offset } = req.query;
		if (source || limit || offset) {
			const items = await getItemsFiltered({ source, limit, offset });
			const augmented = Array.isArray(items)
				? items.map((it) => ({ ...it, comments_url: getHNCommentsUrl(it) }))
				: items;
			return res.json(augmented);
		}
		const items = await getAllItems();
		const augmented = Array.isArray(items)
			? items.map((it) => ({ ...it, comments_url: getHNCommentsUrl(it) }))
			: items;
		res.json(augmented);
	} catch (error) {
		console.error("Error fetching items:", error);
		res.status(500).json({ error: "Failed to fetch items" });
	}
});

// Search endpoint
app.get("/api/search", generalLimiter, async (req, res) => {
	try {
		const { q: query, source, limit, offset } = req.query;

		if (!query || typeof query !== "string" || query.trim().length === 0) {
			return res
				.status(400)
				.json({ error: "Search query parameter 'q' is required" });
		}

		const items = await searchItems({
			query: query.trim(),
			source,
			limit: Number(limit) || 50,
			offset: Number(offset) || 0,
		});

		const augmented = Array.isArray(items)
			? items.map((it) => ({ ...it, comments_url: getHNCommentsUrl(it) }))
			: items;

		res.json({
			query: query.trim(),
			results: augmented,
			count: items.length,
			has_more: items.length === (Number(limit) || 50),
		});
	} catch (error) {
		console.error("Error searching items:", error);
		res.status(500).json({ error: "Failed to search items" });
	}
});

// AI usage and budget endpoint
app.get("/api/usage", generalLimiter, async (req, res) => {
	try {
		const usage = (await getTodayAiUsage()) || {
			tokens_used: 0,
			estimated_cost: 0,
			requests_count: 0,
		};
		const date = new Date().toISOString().slice(0, 10);
		const dailyBudgetUSD = Number(process.env.AI_DAILY_BUDGET_USD || 1.0);
		const costPer1K = Number(process.env.AI_COST_PER_1K_TOKENS_USD || 0.00015);
		const remaining = Math.max(
			0,
			dailyBudgetUSD - Number(usage.estimated_cost || 0)
		);
		res.json({
			date,
			...usage,
			daily_budget_usd: dailyBudgetUSD,
			remaining_budget_usd: remaining,
			exceeded: Number(usage.estimated_cost || 0) >= dailyBudgetUSD,
			cost_per_1k_tokens_usd: costPer1K,
		});
	} catch (error) {
		console.error("Error fetching AI usage:", error);
		res.status(500).json({ error: "Failed to fetch AI usage" });
	}
});

// Research Statements API
app.get("/api/research-statements", generalLimiter, async (req, res) => {
	try {
		const rows = await getAllResearchStatements();
		res.json(rows);
	} catch (err) {
		console.error("Error listing research statements:", err);
		res.status(500).json({ error: "Failed to list research statements" });
	}
});

app.get("/api/research-statements/:id", generalLimiter, async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Invalid id" });
		}
		const row = await getResearchStatementById(id);
		if (!row) return res.status(404).json({ error: "Not found" });
		res.json(row);
	} catch (err) {
		console.error("Error fetching research statement:", err);
		res.status(500).json({ error: "Failed to fetch research statement" });
	}
});

app.post("/api/research-statements", strictLimiter, async (req, res) => {
	try {
		const { name, statement, keywords, negative_keywords, is_active } =
			req.body || {};
		if (typeof name !== "string" || name.trim().length === 0) {
			return res.status(400).json({ error: "name is required" });
		}
		if (typeof statement !== "string" || statement.trim().length < 10) {
			return res
				.status(400)
				.json({ error: "statement must be at least 10 characters" });
		}
		const normalizeStringArray = (arr) => {
			if (arr === undefined) return [];
			if (!Array.isArray(arr)) return null;
			const cleaned = arr
				.map((v) => (typeof v === "string" ? v.trim() : ""))
				.filter((v) => v.length > 0);
			return cleaned;
		};
		const pos = normalizeStringArray(keywords);
		const neg = normalizeStringArray(negative_keywords);
		if (pos === null || neg === null) {
			return res.status(400).json({
				error: "keywords and negative_keywords must be arrays of strings",
			});
		}
		const id = await createResearchStatement({
			name: name.trim(),
			statement: statement.trim(),
			keywords: JSON.stringify(pos || []),
			negative_keywords: JSON.stringify(neg || []),
			is_active: typeof is_active === "boolean" ? is_active : true,
		});

		// Attempt to generate an embedding for the statement (non-blocking failure)
		try {
			const aiService = new AIService();
			if (aiService.isAvailable()) {
				const { embedding } = await aiService.embedText(statement.trim());
				await updateResearchStatementEmbedding(id, embedding);
			}
		} catch (embedErr) {
			console.warn(
				"Embedding generation failed for new research statement:",
				embedErr.message
			);
		}

		const created = await getResearchStatementById(id);
		res.status(201).json(created);
	} catch (err) {
		console.error("Error creating research statement:", err);
		res.status(500).json({ error: "Failed to create research statement" });
	}
});

app.put("/api/research-statements/:id", strictLimiter, async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Invalid id" });
		}
		const { name, statement, keywords, negative_keywords, is_active } =
			req.body || {};
		if (
			name !== undefined &&
			(typeof name !== "string" || name.trim().length === 0)
		) {
			return res
				.status(400)
				.json({ error: "name, if provided, must be non-empty" });
		}
		if (
			statement !== undefined &&
			(typeof statement !== "string" || statement.trim().length < 10)
		) {
			return res.status(400).json({
				error: "statement, if provided, must be at least 10 characters",
			});
		}
		const normalizeStringArray = (arr) => {
			if (arr === undefined) return undefined;
			if (!Array.isArray(arr)) return null;
			const cleaned = arr
				.map((v) => (typeof v === "string" ? v.trim() : ""))
				.filter((v) => v.length > 0);
			return cleaned;
		};
		const pos = normalizeStringArray(keywords);
		const neg = normalizeStringArray(negative_keywords);
		if (pos === null || neg === null) {
			return res.status(400).json({
				error: "keywords and negative_keywords must be arrays of strings",
			});
		}
		if (is_active !== undefined && typeof is_active !== "boolean") {
			return res
				.status(400)
				.json({ error: "is_active, if provided, must be boolean" });
		}
		const changes = await updateResearchStatement(id, {
			name,
			statement,
			keywords: pos !== undefined ? JSON.stringify(pos) : undefined,
			negative_keywords: neg !== undefined ? JSON.stringify(neg) : undefined,
			is_active,
		});
		if (changes === 0) {
			return res.status(404).json({ error: "Not found or no changes" });
		}
		// If statement text changed, regenerate embedding (best-effort)
		let updated = await getResearchStatementById(id);
		try {
			if (typeof statement === "string" && statement.trim().length >= 10) {
				const aiService = new AIService();
				if (aiService.isAvailable()) {
					const { embedding } = await aiService.embedText(statement.trim());
					await updateResearchStatementEmbedding(id, embedding);
					updated = await getResearchStatementById(id);
				}
			}
		} catch (embedErr) {
			console.warn(
				"Embedding regeneration failed on update:",
				embedErr.message
			);
		}
		res.json(updated);
	} catch (err) {
		console.error("Error updating research statement:", err);
		res.status(500).json({ error: "Failed to update research statement" });
	}
});

app.delete("/api/research-statements/:id", strictLimiter, async (req, res) => {
	try {
		const id = Number(req.params.id);
		if (!Number.isFinite(id) || id <= 0) {
			return res.status(400).json({ error: "Invalid id" });
		}
		const changes = await deleteResearchStatement(id);
		if (changes === 0) return res.status(404).json({ error: "Not found" });
		res.json({ success: true });
	} catch (err) {
		console.error("Error deleting research statement:", err);
		res.status(500).json({ error: "Failed to delete research statement" });
	}
});

// Regenerate embedding for a research statement
app.post(
	"/api/research-statements/:id/regenerate-embedding",
	strictLimiter,
	async (req, res) => {
		try {
			const id = Number(req.params.id);
			if (!Number.isFinite(id) || id <= 0) {
				return res.status(400).json({ error: "Invalid id" });
			}

			const row = await getResearchStatementById(id);
			if (!row) return res.status(404).json({ error: "Not found" });

			const aiService = new AIService();
			if (!aiService.isAvailable()) {
				return res.status(503).json({
					error: "AI service not available",
					message: "OPENAI_API_KEY environment variable not set",
				});
			}

			if (
				typeof row.statement !== "string" ||
				row.statement.trim().length < 10
			) {
				return res.status(400).json({
					error: "Statement text invalid for embedding generation",
				});
			}

			const { embedding, usage } = await aiService.embedText(
				row.statement.trim()
			);
			await updateResearchStatementEmbedding(id, embedding);
			const updated = await getResearchStatementById(id);
			return res.json({ ok: true, statement: updated, usage });
		} catch (err) {
			console.error("Error regenerating embedding:", err);
			return res.status(500).json({ error: "Failed to regenerate embedding" });
		}
	}
);

// Feedback API: rate
app.post("/api/feedback/rate", strictLimiter, async (req, res) => {
	try {
		const { content_item_id, research_statement_id, rating } = req.body || {};
		const contentId = Number(content_item_id);
		const statementId = Number(research_statement_id);
		const tier = Number(rating);

		if (!Number.isFinite(contentId) || contentId <= 0) {
			return res.status(400).json({
				error: "content_item_id is required and must be a positive number",
			});
		}
		if (!Number.isFinite(statementId) || statementId <= 0) {
			return res.status(400).json({
				error:
					"research_statement_id is required and must be a positive number",
			});
		}
		if (!Number.isFinite(tier) || tier < 1 || tier > 4) {
			return res
				.status(400)
				.json({ error: "rating must be an integer between 1 and 4" });
		}

		// Verify existence of the research statement
		const rs = await getResearchStatementById(statementId);
		if (!rs) {
			return res.status(404).json({ error: "research_statement not found" });
		}

		const changes = await upsertUserRating(contentId, statementId, tier);
		return res.status(200).json({ ok: true, changes });
	} catch (err) {
		console.error("Error rating content:", err);
		return res.status(500).json({ error: "Failed to save rating" });
	}
});

// Feedback API: stats
app.get("/api/feedback/stats", generalLimiter, async (req, res) => {
	try {
		const { research_statement_id } = req.query || {};
		const statementId = research_statement_id
			? Number(research_statement_id)
			: undefined;
		if (
			statementId !== undefined &&
			(!Number.isFinite(statementId) || statementId <= 0)
		) {
			return res.status(400).json({
				error: "research_statement_id, if provided, must be a positive number",
			});
		}
		if (statementId) {
			const rs = await getResearchStatementById(statementId);
			if (!rs)
				return res.status(404).json({ error: "research_statement not found" });
		}
		const stats = await getUserRatingStats({
			researchStatementId: statementId,
		});
		return res.json(stats);
	} catch (err) {
		console.error("Error fetching feedback stats:", err);
		return res.status(500).json({ error: "Failed to fetch feedback stats" });
	}
});

// Favorites API endpoints
app.post("/api/favorites/toggle", strictLimiter, async (req, res) => {
	try {
		const { content_item_id, is_favorite, research_statement_id } = req.body || {};
		const contentId = Number(content_item_id);
		const isFav = Boolean(is_favorite);
		const statementId = research_statement_id ? Number(research_statement_id) : null;

		if (!Number.isFinite(contentId) || contentId <= 0) {
			return res.status(400).json({
				error: "content_item_id is required and must be a positive number",
			});
		}

		// Validate research_statement_id if provided
		if (statementId !== null && (!Number.isFinite(statementId) || statementId <= 0)) {
			return res.status(400).json({
				error: "research_statement_id, if provided, must be a positive number",
			});
		}

		// If favoriting with research statement, verify it exists
		if (isFav && statementId) {
			const rs = await getResearchStatementById(statementId);
			if (!rs) {
				return res.status(404).json({ error: "research_statement not found" });
			}
		}

		const result = await toggleFavorite(contentId, isFav, statementId);
		return res.json({ 
			ok: true, 
			is_favorite: isFav,
			changes: result.changes,
			rating_set: result.ratingSet
		});
	} catch (err) {
		console.error("Error toggling favorite:", err);
		if (err.message === "Content item not found") {
			return res.status(404).json({ error: "Content item not found" });
		}
		return res.status(500).json({ error: "Failed to toggle favorite" });
	}
});

app.get("/api/favorites", generalLimiter, async (req, res) => {
	try {
		const { only, limit, offset } = req.query;
		
		// If only=true, return only favorites
		if (only === "true") {
			const favorites = await getFavoriteItems({
				limit: Number(limit) || 50,
				offset: Number(offset) || 0
			});
			const augmented = Array.isArray(favorites)
				? favorites.map((it) => ({ ...it, comments_url: getHNCommentsUrl(it) }))
				: favorites;
			return res.json(augmented);
		}

		// Otherwise, fall back to regular items endpoint behavior (all items)
		const items = await getItemsFiltered({ 
			limit: Number(limit) || 50, 
			offset: Number(offset) || 0 
		});
		const augmented = Array.isArray(items)
			? items.map((it) => ({ ...it, comments_url: getHNCommentsUrl(it) }))
			: items;
		res.json(augmented);
	} catch (error) {
		console.error("Error fetching favorites:", error);
		res.status(500).json({ error: "Failed to fetch favorites" });
	}
});

// Settings endpoints
const fs = require("fs").promises;

const SETTINGS_FILE = path.join(__dirname, "config", "user-settings.json");

// Get current settings
app.get("/api/settings", generalLimiter, async (req, res) => {
	try {
		const data = await fs.readFile(SETTINGS_FILE, "utf8");
		const settings = JSON.parse(data);
		res.json(settings);
	} catch (error) {
		console.error("Error reading settings:", error);
		// Return default settings if file doesn't exist or is corrupted
		const defaultSettings = {
			hackernews: {
				maxItems: 50,
				keywords: [
					"ai",
					"llm",
					"language model",
					"gpt",
					"openai",
					"anthropic",
					"claude",
					"llama",
					"transformer",
					"rag",
					"embedding",
					"fine-tuning",
					"copilot",
					"cursor",
					"code generation",
					"agents",
				],
			},
		};
		res.json(defaultSettings);
	}
});

// Update settings
app.put("/api/settings", generalLimiter, async (req, res) => {
	try {
		const newSettings = req.body;

		// Basic validation
		if (!newSettings || typeof newSettings !== "object") {
			return res.status(400).json({ error: "Invalid settings format" });
		}

		if (newSettings.hackernews) {
			const hn = newSettings.hackernews;

			// Validate maxItems
			if (
				typeof hn.maxItems !== "number" ||
				hn.maxItems < 1 ||
				hn.maxItems > 100
			) {
				return res
					.status(400)
					.json({ error: "maxItems must be a number between 1 and 100" });
			}

			// Validate keywords
			if (!Array.isArray(hn.keywords) || hn.keywords.length === 0) {
				return res
					.status(400)
					.json({ error: "keywords must be a non-empty array" });
			}

			// Clean up keywords
			hn.keywords = hn.keywords
				.map((k) => (typeof k === "string" ? k.trim() : ""))
				.filter((k) => k.length > 0);

			if (hn.keywords.length === 0) {
				return res
					.status(400)
					.json({ error: "At least one valid keyword is required" });
			}
		}

		// Write settings to file
		await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));

		res.json({ success: true, message: "Settings updated successfully" });
	} catch (error) {
		console.error("Error updating settings:", error);
		res.status(500).json({ error: "Failed to update settings" });
	}
});

// Test endpoint to verify API is working
app.post("/api/test", generalLimiter, (req, res) => {
	console.log(`[${new Date().toISOString()}] Test endpoint hit`);
	res.json({
		message: "Test endpoint works",
		timestamp: new Date().toISOString(),
	});
});

// Manual Hacker News collection trigger
app.post("/api/collectors/hackernews", strictLimiter, (req, res) => {
	console.log(
		`[${new Date().toISOString()}] API endpoint hit: /api/collectors/hackernews`
	);

	// Return immediately and run collection in background
	res.json({
		status: "ok",
		message: "Collection started in background",
		timestamp: new Date().toISOString(),
	});

	// Run collection in background without blocking response
	runHackerNewsCollection()
		.then((result) => {
			if (result.success) {
				console.log(
					`[${new Date().toISOString()}] Background HN collection completed: ${
						result.inserted
					} items inserted`
				);
			} else {
				console.error(
					`[${new Date().toISOString()}] Background HN collection failed: ${
						result.error
					}`
				);
			}
		})
		.catch((error) => {
			console.error(
				`[${new Date().toISOString()}] Background HN collection error:`,
				error
			);
		});
});

// AI service test endpoint
app.get("/api/ai/test", strictLimiter, async (req, res) => {
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

// (Removed temporary /api/_debug/routes dev endpoint)

// Initialize database and start server
async function startServer() {
	try {
		await initializeDatabase();
		console.log("Database initialized successfully");

		// Removed legacy sample data insertion

		// Initialize scheduler
		initializeScheduler();

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to initialize database:", error);
		process.exit(1);
	}
}

startServer();
