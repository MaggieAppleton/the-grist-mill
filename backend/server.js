// Load environment variables
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const rateLimit = require("express-rate-limit");
const {
	initializeDatabase,
	insertSampleData,
	getAllItems,
	getItemsFiltered,
	searchItems,
	insertContentItems,
	getTodayAiUsage,
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
