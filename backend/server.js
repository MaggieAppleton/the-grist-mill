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
		const hydrated = await discoverAndHydrateHN();
		const items = hydrated.map((it) => {
			const f = it.firebase || {};
			return {
				source_type: "hackernews",
				source_id: String(it.id),
				title: f.title || null,
				summary: f.title
					? `${f.title} — ${f.score ?? 0} points by ${f.by ?? "unknown"}`
					: null,
				raw_content: JSON.stringify({
					firebase: f,
					algolia: it.algolia || null,
				}),
				url:
					f.url ||
					(f.id ? `https://news.ycombinator.com/item?id=${f.id}` : null),
			};
		});
		const inserted = await insertContentItems(items);
		res.json({ status: "ok", inserted });
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

		// Insert sample data
		await insertSampleData();
		console.log("Sample data inserted successfully");

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to initialize database:", error);
		process.exit(1);
	}
}

startServer();
