const OpenAI = require("openai");

class AIService {
	constructor() {
		const apiKey = process.env.OPENAI_API_KEY;

		if (!apiKey) {
			console.warn(
				"Warning: OPENAI_API_KEY not found in environment variables"
			);
			this.client = null;
			return;
		}

		this.client = new OpenAI({
			apiKey: apiKey,
		});
	}

	async testConnection() {
		if (!this.client) {
			throw new Error(
				"OpenAI client not initialized - check OPENAI_API_KEY environment variable"
			);
		}

		try {
			const response = await this.client.chat.completions.create({
				model: "gpt-5-mini",
				messages: [
					{
						role: "user",
						content:
							"Hello! Please respond with 'AI service is working' if you can see this message.",
					},
				],
				max_tokens: 50,
			});

			return {
				success: true,
				message: response.choices[0].message.content,
				usage: response.usage,
			};
		} catch (error) {
			console.error("OpenAI API test failed:", error.message);
			throw error;
		}
	}

	async generateSummary(content, context = "") {
		if (!this.client) {
			throw new Error(
				"OpenAI client not initialized - check OPENAI_API_KEY environment variable"
			);
		}

		try {
			const prompt = `Please provide a brief, informative summary of the following content. 
            Focus on the key points and make it useful for someone interested in AI/LLM and software development topics.
            
            ${context ? `Context: ${context}\n\n` : ""}Content: ${content}`;

			const response = await this.client.chat.completions.create({
				model: "gpt-5-mini",
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
				max_tokens: 200,
				temperature: 0.7,
			});

			return {
				success: true,
				summary: response.choices[0].message.content,
				usage: response.usage,
			};
		} catch (error) {
			console.error("OpenAI summary generation failed:", error.message);
			throw error;
		}
	}

	isAvailable() {
		return this.client !== null;
	}
}

module.exports = AIService;
