# The Grist Mill - Product Specification

Updated: August 26, 2025 8:33AM

## Overview

A personal web-based dashboard that aggregates and summarizes content from various sources using AI. Initially focused on Hacker News with AI-driven filtering, designed to be extensible for future content sources like Discord, Bluesky, Reddit, etc. Built for single-user local/personal hosting.

Note: The application is and will remain single-user only. Concepts like favorites (hearts) are stored directly on content items and do not require multi-user modeling.

## User Story

"As someone who wants to stay informed across multiple platforms without being overwhelmed, I want a single dashboard that shows AI-summarized content from my important sources, so I can quickly scan what's relevant without opening multiple apps."

## Core Requirements

### Functional Requirements

1. **Content Collection**

   - Hacker News collector (MVP): runs daily at 6 AM, discovers stories from last 24h matching AI/LLM interests via Algolia HN Search, hydrates canonical item data from official Firebase API
   - Rate limiting/backoff between external requests
   - Initial sync: Fetches last 1-2 days only, or starts fresh with next day's collection
   - Modular collector architecture for future extensibility
   - Each collector outputs standardized content objects

2. **Content Processing**

   - AI summarization service (abstracted for reuse)
   - Cost tracking and daily budget limits ($1/day for OpenAI calls)
   - Graceful fallback when AI service fails
   - Basic keyword filtering (pre-AI filtering)
   - Store both raw content and processed summaries

3. **Web Dashboard**

   - Clean, scannable timeline interface
   - Responsive design (desktop and mobile)
   - Reverse chronological order
   - Manual refresh (since content updates once daily)
   - Markdown rendering for summaries with embedded citation links
   - No read/unread states, no archiving (infinite scroll)

4. **Data Persistence**

   - SQLite database for personal use
   - Store all content items indefinitely
   - Simple logging with timestamps for debugging

5. **User Feedback and Favorites**

   - Relevance rating (4 tiers): Not Relevant, Weakly Relevant, Relevant, Very Relevant
   - Favorite (heart) toggle on items; when favorited, the system also persists a Very Relevant (tier 4) rating for the active research statement

6. **Multi-Topic Dashboards**

   - Support multiple research topics, each with:
     - A title (name)
     - A research statement (used for embeddings)
     - Its own keyword filters (and optional negative keywords)
   - The dashboard can be filtered by an active topic to show per-topic ranking, filtering, and favorites context

### Non-Functional Requirements

- **Simplicity**: Minimal features to start, easy to extend
- **Reliability**: Handle API failures gracefully with simple error logging
- **Performance**: Fast dashboard loading, efficient database queries
- **Mobile-friendly**: Clean interface on phone screens
- **Cost Control**: Daily AI budget limits and usage tracking

## Technical Architecture

### Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: React
- **Database**: SQLite
- **AI Service**: OpenAI GPT-4o-mini (with cost tracking and daily budget limits)
- **Structure**: Monorepo with `/backend` and `/frontend` folders

### Backend Architecture

```
/backend
├── src/
│   ├── api/           # Express routes
│   ├── collectors/    # Source-specific collectors
│   ├── services/      # AI service, database service
│   ├── jobs/          # Background job scheduler
│   ├── models/        # Database models/schemas
│   └── utils/         # Shared utilities
├── database/          # SQLite file location
└── config/           # Configuration files
```

### Frontend Architecture

```
/frontend
├── src/
├── components/    # React components
├── services/      # API client
├── hooks/         # Custom React hooks
└── styles/        # CSS/styling
└── public/        # Static assets
```

## Database Schema

- See `planning/features/filter_rank_system.md` for advanced filtering/favorites schema; app is single-user and stores favorites on `content_items`.

## API Specification

### Endpoints

- `GET /api/items` - Retrieve content items
  - Query params: `limit` (default 50), `offset`, `source`
  - Response: Array of content items with metadata
- `GET /api/health` - Health check endpoint
- `GET /api/usage` - Get daily AI usage and cost tracking
- `POST /api/collectors/trigger/:name` - Manual collector trigger (dev only)
- `POST /api/collectors/hackernews` - Trigger Hacker News collection (MVP)

### Content Item Response Format

```json
{
	"id": 123,
	"source": "hackernews",
	"title": "Tech Community - 5 discussions",
	"summary": "{title} — {score} points by {by}",
	"url": null,
	"metadata": {
		"score": 247,
		"author": "pg",
		"hn_id": 42424242,
		"highlight": true
	},
	"created_at": "2025-08-15T06:00:00Z",
	"processed_at": "2025-08-15T06:05:00Z"
}
```

## Service Modules

### AI Service

```javascript
class AIService {
	constructor() {
		this.dailyBudget = 1.0; // $1 per day
		this.tokenCost = 0.00015; // GPT-4o-mini cost per 1K tokens
	}

	async summarize(content, context = "general") {
		// Check daily budget before making calls
		await this.checkDailyBudget();

		// Abstracted AI calls with different prompts based on context
		// For Discord: includes citation prompt for embedded links
		// For single sources: standard summarization

		// Track usage after successful call
		await this.trackUsage(tokensUsed, estimatedCost);
	}

	async checkDailyBudget() {
		const todayUsage = await this.getTodayUsage();
		if (todayUsage.estimated_cost >= this.dailyBudget) {
			throw new Error("Daily AI budget exceeded");
		}
	}

	async trackUsage(tokens, cost) {
		// Update ai_usage table with daily totals
	}
}
```

### Collectors Interface

```javascript
class BaseCollector {
	async collect() {
		// Returns array of standardized content objects
	}

	getSchedule() {
		// Returns cron-style schedule string
	}
}

class HackerNewsCollector extends BaseCollector {
	constructor() {
		this.rateLimit = 100; // 100ms delay between external requests
	}

	async collect() {
		// Discover via Algolia, hydrate via Firebase
		return [];
	}
}
```

## Configuration Schema

### Environment Variables (`.env`)

```bash
# Required API keys
OPENAI_API_KEY=your_openai_api_key

# HN collection configuration
HN_MAX_ITEMS=50
HN_QUERY=ai,llm,language model,gpt,openai,anthropic,claude,llama,transformer,rag,embedding,fine-tuning,copilot,cursor,code generation,agents
```

### `config/default.json`

```json
{
	"database": {
		"path": "./database/dashboard.db"
	},
	"ai": {
		"provider": "openai",
		"model": "gpt-4o-mini",
		"maxTokens": 500,
		"dailyBudgetUSD": 1.0,
		"costPerThousandTokens": 0.00015
	},
	"collectors": {
		"discord": {
			"enabled": true,
			"schedule": "0 6 * * *",
			"rateLimitMs": 100,
			"initialSyncDays": 1,
			"servers": [
				{
					"name": "Tech Community",
					"guildId": "123456789",
					"excludedChannels": ["spam", "bot-commands"]
				},
				{
					"name": "Dev Community",
					"guildId": "987654321",
					"excludedChannels": ["general", "random"]
				}
			]
		}
	},
	"server": {
		"port": 3001
	},
	"logging": {
		"level": "info",
		"includeTimestamp": true
	}
}
```

## Development Setup

1. **Prerequisites**: Node.js 18+, npm
2. **Installation**:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. **Environment**: Create `.env` file with required API keys (see Environment Variables section)
4. **Database**: Auto-created SQLite file on first run
5. **Initial Sync**:
   ```bash
   npm run collect:discord --initial  # Optional: fetch last 1-2 days
   ```
6. **Development**:
   ```bash
   npm run dev  # Starts both backend and frontend
   ```

## Job Scheduling

- **Hacker News Collector**: Daily at 6 AM (cron: `0 6 * * *`)
- **Rate Limiting**: 100ms delays/backoff between external API calls
- **Error Handling**: Simple logging, continue processing other channels on failures
- **Future Collectors**: Configurable schedules per collector
- **Implementation**: node-cron for personal use

## Future Extension Points

- **New Collectors**: Implement `BaseCollector` interface
- **AI Prompts**: Configurable prompts per source type
- **Filtering**: Keywords, relevance scoring, user preferences
- **UI Features**: Filtering, search, archiving, tagging
- **Deployment**: Docker, cloud hosting, database migration

## Success Metrics

- Dashboard loads quickly (<2 seconds)
- Daily Hacker News summaries appear consistently at 6 AM
- AI costs stay under $1/day with meaningful summaries
- Mobile interface is clean and readable
- Simple error logging helps debug issues
- Easy to add new collectors (under 100 lines of code)
- Minimal maintenance required for personal use
