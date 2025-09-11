# The Grist Mill - Product Specification

Updated: September 11, 2025 5:00PM BST

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
├── collectors/            # Source-specific collectors
├── jobs/                  # Background job scheduler
├── services/              # AI/content services (business logic)
├── db/                    # Database layer (modularized)
│   ├── connection.js      # SQLite connection (single shared db)
│   ├── schema.js          # initializeDatabase(): creates tables, indexes, seeds
│   ├── items.js           # content_items CRUD + queries
│   ├── aiUsage.js         # ai_usage upsert/get helpers
│   ├── researchStatements.js   # research statements CRUD
│   ├── contentFeatures.js # per-item/statement embeddings + similarity ops
│   └── userRatings.js     # upsert + aggregate stats
├── database.js            # Facade re-exporting db layer (stable API)
├── config/                # Configuration files
└── grist_mill.db          # SQLite file location
```

### Frontend Architecture

```
/frontend
├── public/                    # Static assets
├── src/
│   ├── main.jsx               # App entry
│   ├── App.jsx                # Root component
│   ├── index.css              # Global styles
│   ├── App.css                # App-level styles
│   ├── assets/                # Static assets used in the app
│   ├── components/            # React components
│   │   ├── HeaderBar/
│   │   ├── Timeline/
│   │   └── modals/
│   ├── hooks/                 # Custom React hooks
│   │   ├── useFeed.js
│   │   ├── useResearchStatements.js
│   │   ├── useSearch.js
│   │   └── useSettings.js
│   ├── services/              # API client
│   │   └── api.js
│   └── utils/                 # Helpers (dates, markdown, etc.)
│       ├── dates.js
│       ├── items.js
│       └── markdown.js
└── dist/                      # Build output (Vite)
```

## Database Schema

- See `planning/features/filter_rank_system.md` for advanced filtering/favorites schema; app is single-user and stores favorites on `content_items`.

## API Specification

### Endpoints

- `GET /api/health` - Health check
- `GET /api/items` - List content items
  - Query params: `source`, `limit`, `offset`
- `GET /api/search` - Full-text search across items
  - Query params: `q` (required), `source`, `limit` (default 50), `offset` (default 0)
- `GET /api/usage` - Today's AI usage and budget summary

- Research Statements
  - `GET /api/research-statements` - List all research statements
  - `GET /api/research-statements/:id` - Get one
  - `POST /api/research-statements` - Create (body: `name`, `statement`, `keywords[]`, `negative_keywords[]`, `is_active`)
  - `PUT /api/research-statements/:id` - Update
  - `DELETE /api/research-statements/:id` - Delete
  - `POST /api/research-statements/:id/regenerate-embedding` - Rebuild embedding

- Feedback
  - `POST /api/feedback/rate` - Rate relevance (body: `content_item_id`, `research_statement_id`, `rating` 1-4)
  - `GET /api/feedback/stats` - Aggregate ratings (query: `research_statement_id` optional)

- Settings
  - `GET /api/settings` - Get user settings
  - `PUT /api/settings` - Update user settings

- Collectors
  - `POST /api/collectors/hackernews` - Trigger Hacker News collection (runs in background)

- AI
  - `GET /api/ai/test` - Test AI service connectivity

- Development utilities
  - `POST /api/test` - Simple test endpoint

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
