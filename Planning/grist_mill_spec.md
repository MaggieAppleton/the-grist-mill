# The Grist Mill - Product Specification

Updated: August 15th, 2025 at 8:30am

## Overview

A personal web-based dashboard that aggregates and summarizes content from various sources using AI. Initially focused on Discord server summaries, designed to be extensible for future content sources like Bluesky, Hacker News, Reddit, etc. Built for single-user local/personal hosting.

## User Story

"As someone who wants to stay informed across multiple platforms without being overwhelmed, I want a single dashboard that shows AI-summarized content from my important sources, so I can quickly scan what's relevant without opening multiple apps."

## Core Requirements

### Functional Requirements

1. **Content Collection**

   - Discord collector: runs daily at 6 AM, gathers previous day's messages from ~20 channels across 2 servers
   - Rate limiting: Simple delays between API calls to respect Discord limits
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
│   ├── components/    # React components
│   ├── services/      # API client
│   ├── hooks/         # Custom React hooks
│   └── styles/        # CSS/styling
└── public/           # Static assets
```

## Database Schema

### `content_items` table

```sql
CREATE TABLE content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source VARCHAR(50) NOT NULL,           -- 'discord', 'bluesky', 'hackernews'
  source_id VARCHAR(255),                -- Original ID from source platform
  title VARCHAR(500),                    -- Generated or extracted title
  summary TEXT NOT NULL,                 -- AI-generated summary (markdown with embedded citations)
  raw_content TEXT,                      -- Original content (JSON)
  url VARCHAR(500),                      -- Single URL for single-source items (HN posts, etc)
  metadata JSON,                         -- Source-specific data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_source_created ON content_items(source, created_at);
CREATE INDEX idx_created_at ON content_items(created_at DESC);
```

### `collector_runs` table (for tracking job execution)

```sql
CREATE TABLE collector_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collector_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,          -- 'success', 'failed', 'running'
  items_collected INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

### `ai_usage` table (for cost tracking)

```sql
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,4) DEFAULT 0,
  requests_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_ai_usage_date ON ai_usage(date);
```

## API Specification

### Endpoints

- `GET /api/items` - Retrieve content items
  - Query params: `limit` (default 50), `offset`, `source`
  - Response: Array of content items with metadata
- `GET /api/health` - Health check endpoint
- `GET /api/usage` - Get daily AI usage and cost tracking
- `POST /api/collectors/trigger/:name` - Manual collector trigger (dev only)

### Content Item Response Format

```json
{
	"id": 123,
	"source": "discord",
	"title": "Tech Community - 5 discussions",
	"summary": "**#general**: New React 19 features being discussed, particularly the new compiler optimizations. [Jump to conversation](https://discord.com/channels/123456789/111111111/222222222)\n\n**#help**: Multiple users reporting deployment issues with Vercel. @alice provided a helpful solution. [See solution](https://discord.com/channels/123456789/333333333/444444444)\n\n**#standup**: Team shared progress updates, Sprint 12 wrapping up ahead of schedule.",
	"url": null,
	"metadata": {
		"server_name": "Tech Community",
		"channels": ["general", "help", "standup"],
		"message_count": 47
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

class DiscordCollector extends BaseCollector {
	constructor() {
		this.rateLimit = 100; // 100ms delay between API calls
	}

	async collect() {
		const results = [];
		for (const server of this.servers) {
			for (const channel of this.getIncludedChannels(server)) {
				try {
					const messages = await this.fetchChannelMessages(channel);
					results.push(...messages);
					await this.delay(this.rateLimit); // Rate limiting
				} catch (error) {
					console.log(`Failed to fetch ${channel.name}: ${error.message}`);
					// Continue with other channels
				}
			}
		}
		return results;
	}

	getIncludedChannels(server) {
		// Include all channels except those in excludedChannels list
		return server.channels.filter(
			(ch) => !server.excludedChannels.includes(ch.name)
		);
	}
}
```

## Configuration Schema

### Environment Variables (`.env`)

```bash
# Required API keys
DISCORD_TOKEN=your_discord_bot_token
OPENAI_API_KEY=your_openai_api_key

# Discord server configuration
DISCORD_SERVERS=server1_guild_id,server2_guild_id

# Optional: excluded channels (comma-separated)
EXCLUDED_CHANNELS=spam,bot-commands,off-topic
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

- **Discord Collector**: Daily at 6 AM (cron: `0 6 * * *`)
- **Rate Limiting**: 100ms delays between Discord API calls
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
- Daily Discord summaries appear consistently at 6 AM
- AI costs stay under $1/day with meaningful summaries
- Mobile interface is clean and readable
- Simple error logging helps debug issues
- Easy to add new collectors (under 100 lines of code)
- Minimal maintenance required for personal use
