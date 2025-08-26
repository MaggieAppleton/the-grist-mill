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
				model: "gpt-4o-mini",
				messages: [
					{
						role: "user",
						content:
							"Hello! Please respond with 'AI service is working' if you can see this message.",
					},
				],
				max_completion_tokens: 50,
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
				model: "gpt-4o-mini",
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
				max_completion_tokens: 200,
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

	async processHackerNewsItem(hnItem) {
		if (!this.client) {
			throw new Error(
				"OpenAI client not initialized - check OPENAI_API_KEY environment variable"
			);
		}

		try {
			// Define user interest areas for AI/LLM and software development
			const userInterests = `
User is interested in:
- AI/LLM: Large language models, GPT, Claude, Llama, transformers, RAG, embeddings, fine-tuning, AI agents, AI assistants
- Software Development: Code generation, programming tools, development workflows, software architecture, debugging, testing, deployment, developer productivity tools
- Emerging Tech: New AI capabilities, breakthrough research, practical applications of AI in software development
`;

			const prompt = `${userInterests}

Please analyze this Hacker News story and provide a JSON response with the following structure:
{
  "summary": "A concise, informative summary (2-3 sentences) that highlights the key technical aspects",
  "relevance_score": 7,
  "relevance_explanation": "A brief explanation of why this is relevant or not relevant",
  "highlight": true
}

Set highlight to true if relevance_score >= 7, false otherwise.

Hacker News Story:
Title: ${hnItem.title || "No title"}
URL: ${hnItem.url || "No URL"}
Score: ${hnItem.score || 0} points
Author: ${hnItem.by || "Unknown"}
${hnItem.text ? `Text: ${hnItem.text}` : ""}

Please respond with valid JSON only.`;

			const response = await this.client.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
				max_completion_tokens: 300,
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "hacker_news_analysis",
						strict: true,
						schema: {
							type: "object",
							properties: {
								summary: { type: "string" },
								relevance_score: { type: "integer", minimum: 1, maximum: 10 },
								relevance_explanation: { type: "string" },
								highlight: { type: "boolean" },
							},
							required: [
								"summary",
								"relevance_score",
								"relevance_explanation",
								"highlight",
							],
							additionalProperties: false,
						},
					},
				},
			});

			const content = response.choices[0].message.content;
			console.log("AI Response content:", content);

			let result;
			try {
				result = JSON.parse(content);
			} catch (parseError) {
				console.error("JSON parse error:", parseError.message);
				console.error("Raw content:", content);
				throw new Error(`Invalid JSON response: ${parseError.message}`);
			}

			return {
				success: true,
				summary: result.summary,
				highlight: result.highlight,
				relevance_score: result.relevance_score,
				relevance_explanation: result.relevance_explanation,
				usage: response.usage,
			};
		} catch (error) {
			console.error("OpenAI Hacker News processing failed:", error.message);
			throw error;
		}
	}

	isAvailable() {
		return this.client !== null;
	}
}

module.exports = AIService;
