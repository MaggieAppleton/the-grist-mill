const OpenAI = require("openai");
const { getTodayAiUsage, incrementAiUsage } = require("../database");

class AIService {
	constructor() {
		const apiKey = process.env.OPENAI_API_KEY;

		// Configure budget and pricing (defaults align with spec; can override via env)
		this.dailyBudgetUSD = Number(process.env.AI_DAILY_BUDGET_USD || 1.0);
		this.costPerThousandTokensUSD = Number(
			process.env.AI_COST_PER_1K_TOKENS_USD || 0.00015
		);

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

	async embedText(text) {
		if (!this.client) {
			throw new Error(
				"OpenAI client not initialized - check OPENAI_API_KEY environment variable"
			);
		}

		const input = String(text || "").trim();
		if (input.length === 0) {
			throw new Error("Text is required to generate an embedding");
		}

		try {
			await this.checkDailyBudget();
			const model = process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small";
			const response = await this.client.embeddings.create({
				model,
				input,
			});

			// Record usage if provided by API
			await this.recordUsage(response.usage);

			const vector =
				response && response.data && response.data[0]
					? response.data[0].embedding
					: null;
			if (!Array.isArray(vector)) {
				throw new Error("Failed to generate embedding vector");
			}
			return { embedding: vector, usage: response.usage };
		} catch (error) {
			console.error("OpenAI embedding generation failed:", error.message);
			throw error;
		}
	}

	async checkDailyBudget() {
		try {
			const today = await getTodayAiUsage();
			if (
				today &&
				typeof today.estimated_cost === "number" &&
				today.estimated_cost >= this.dailyBudgetUSD
			) {
				throw new Error("Daily AI budget exceeded");
			}
		} catch (err) {
			// If usage table not available yet, allow call to proceed
		}
	}

	computeEstimatedCostFromUsage(usage) {
		try {
			if (!usage) return 0;
			const totalTokens =
				Number(usage.total_tokens) ||
				Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0);
			if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
			return (totalTokens / 1000) * this.costPerThousandTokensUSD;
		} catch (_) {
			return 0;
		}
	}

	async recordUsage(usage) {
		try {
			if (!usage) return;
			const totalTokens =
				Number(usage.total_tokens) ||
				Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0);
			const estimatedCost = this.computeEstimatedCostFromUsage(usage);
			await incrementAiUsage({
				tokensUsed: Math.max(0, Math.floor(totalTokens || 0)),
				estimatedCost: Math.max(0, Number(estimatedCost) || 0),
				requestsCount: 1,
			});
		} catch (err) {
			// Do not fail primary flow due to tracking issues
		}
	}

	async testConnection() {
		if (!this.client) {
			throw new Error(
				"OpenAI client not initialized - check OPENAI_API_KEY environment variable"
			);
		}

		try {
			await this.checkDailyBudget();
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

			await this.recordUsage(response.usage);

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
			await this.checkDailyBudget();
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

			await this.recordUsage(response.usage);

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
			await this.checkDailyBudget();
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
  "relevance_score": 7,
  "highlight": true,
  "relevance_explanation": "Explain relevance succinctly; if highlight is false, set to empty string \"\""
}

Rules:
- Set highlight to true if relevance_score >= 7, false otherwise.
- Do NOT create or include a content summary at this stage.
- Always include the field relevance_explanation. When highlight is false, set it to an empty string "".

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
								relevance_score: { type: "integer", minimum: 1, maximum: 10 },
								highlight: { type: "boolean" },
								relevance_explanation: { type: "string" },
							},
							required: [
								"relevance_score",
								"highlight",
								"relevance_explanation",
							],
							additionalProperties: false,
						},
					},
				},
			});

			await this.recordUsage(response.usage);

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
				highlight: result.highlight,
				relevance_score: result.relevance_score,
				relevance_explanation:
					typeof result.relevance_explanation === "string" &&
					result.relevance_explanation.trim().length > 0
						? result.relevance_explanation
						: undefined,
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
