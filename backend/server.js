const express = require("express");
const { initializeDatabase } = require("./database");
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
		service: "The Grist Mill Backend"
	});
});

app.get("/api/items", (req, res) => {
	// Returns empty array initially - will be populated with real data later
	res.json([]);
});

// Initialize database and start server
async function startServer() {
	try {
		await initializeDatabase();
		console.log("Database initialized successfully");

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Failed to initialize database:", error);
		process.exit(1);
	}
}

startServer();
