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
		error: 'Too many requests from this IP, please try again later.',
		retryAfter: '15 minutes'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

const strictLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes  
	max: 10, // limit each IP to 10 requests per windowMs
	message: {
		error: 'Too many requests for this resource, please try again later.',
		retryAfter: '15 minutes'
	},
	standardHeaders: true,
	legacyHeaders: false,
});

const healthLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 200,
	message: {
		error: 'Too many health check requests, please try again later.',
		retryAfter: '15 minutes'
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

app.get("/api/items", generalLimiter, async (req, res) => {
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

// Test endpoint to verify API is working
app.post("/api/test", generalLimiter, (req, res) => {
	console.log(`[${new Date().toISOString()}] Test endpoint hit`);
	res.json({ message: "Test endpoint works", timestamp: new Date().toISOString() });
});

// Manual Hacker News collection trigger
app.post("/api/collectors/hackernews", strictLimiter, (req, res) => {
	console.log(`[${new Date().toISOString()}] API endpoint hit: /api/collectors/hackernews`);
	
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
				console.log(`[${new Date().toISOString()}] Background HN collection completed: ${result.inserted} items inserted`);
			} else {
				console.error(`[${new Date().toISOString()}] Background HN collection failed: ${result.error}`);
			}
		})
		.catch((error) => {
			console.error(`[${new Date().toISOString()}] Background HN collection error:`, error);
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
