const AIService = require("../services/ai");

async function testAIService() {
	console.log("Testing AI Service...\n");

	const aiService = new AIService();

	console.log("AI Service available:", aiService.isAvailable());

	if (!aiService.isAvailable()) {
		console.log("\nTo test with OpenAI API:");
		console.log("1. Get an API key from https://platform.openai.com/api-keys");
		console.log(
			'2. Set the environment variable: export OPENAI_API_KEY="your-key-here"'
		);
		console.log("3. Run this script again");
		return;
	}

	try {
		console.log("\nTesting OpenAI connection...");
		const result = await aiService.testConnection();
		console.log("✅ Connection successful!");
		console.log("Response:", result.message);
		console.log("Usage:", result.usage);

		console.log("\nTesting summary generation...");
		const summaryResult = await aiService.generateSummary(
			"OpenAI released GPT-4, a large multimodal model that can solve complex problems with greater accuracy than its predecessors.",
			"Hacker News story about AI development"
		);
		console.log("✅ Summary generated!");
		console.log("Summary:", summaryResult.summary);
		console.log("Usage:", summaryResult.usage);
	} catch (error) {
		console.error("❌ Test failed:", error.message);
	}
}

testAIService();
