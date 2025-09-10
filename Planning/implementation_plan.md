# The Grist Mill - Implementation Plan

Updated: September 10, 2025

## Overview

This plan breaks down the implementation into focused phases, prioritizing getting data on the page quickly before adding refinements. Each phase should result in a working system.

## Prototyping Data Policy (No Migrations)

- During prototyping, we will not write database migrations. When schema changes are needed, we will reset the SQLite database to align with the latest schema.
- Operational steps: stop backend, delete `backend/grist_mill.db`, restart backend to reinitialize schema, then re-run collectors to repopulate data.
- Current code already auto-resets `content_items` if required columns are missing (see `backend/database.js`). We will apply the same approach for new tables/columns added by Phase 8.

---

## Phase 1: Basic Backend Foundation

**Goal**: Get a minimal backend running with database and basic API

### Task 1.1: Project Structure

- [x] Create `/backend` and `/frontend` directories
- [x] Initialize backend `package.json` with Express dependency
- [x] Create basic `server.js` file that starts Express on port 3001

**Commit**: "Initial project structure and Express setup" ✅ **COMPLETED**

### Task 1.2: Database Schema

- [x] Add SQLite3 dependency
- [x] Create database initialization script
- [x] Implement `content_items` table creation

**Commit**: "Add SQLite database with content_items table" ✅ **COMPLETED**

### Task 1.3: Basic API Endpoints

- [x] Implement `GET /api/health` endpoint
- [x] Implement `GET /api/items` endpoint (returns empty array initially)
- [x] Test both endpoints return JSON

**Commit**: "Add basic API endpoints" ✅ **COMPLETED**

### Task 1.4: Sample Data

- [x] Create script to insert sample content item
- [x] Verify API returns the sample data

**Commit**: "Add sample data insertion and retrieval" ✅ **COMPLETED**

---

## Phase 2: Basic Hacker News Data Collection

**Goal**: Fetch Hacker News stories from the last 24 hours and store them (without AI processing yet)

### Task 2.1: HN Discovery + Hydration

- [x] Use Algolia HN Search API to discover stories from the last 24h matching initial keyword filters (AI/LLM)
- [x] Hydrate discovered IDs via official Firebase API to retrieve canonical item data
- [x] Limit to a configurable max items (e.g., 50)

**Commit**: "Add Hacker News discovery and hydration"

### Task 2.2: Store Hacker News Stories

- [x] Map HN items to `content_items` format (`source: "hackernews"`)
- [x] Store title, url, author, score, time, and raw JSON
- [x] Create simple summary text (e.g., "{title} — {score} points by {by}")

**Commit**: "Store Hacker News stories in database"

### Task 2.3: Manual Collection Endpoint

- [x] Add `POST /api/collectors/hackernews` endpoint
- [x] Trigger collection manually via API call
- [x] Return success/failure status and items count

**Commit**: "Add manual Hacker News collection trigger"

---

## Phase 3: Basic Frontend Dashboard

**Goal**: Display collected data in a simple, clean interface

### Task 3.1: React App Setup

- [x] Create React app in `/frontend` directory
- [x] Start development server on port 3000
- [x] Remove default content, create empty dashboard component

**Commit**: "Initialize React frontend" ✅ **COMPLETED**

### Task 3.2: API Client

- [x] Create API client function to fetch items from backend
- [x] Test API call returns data in React component
- [x] Display raw JSON data on page

**Commit**: "Add API client and data fetching" ✅ **COMPLETED**

### Task 3.3: Basic Timeline Layout

- [x] Create simple list component to display content items
- [x] Show title, summary, and timestamp for each item
- [x] Add basic CSS for readability

**Commit**: "Add basic timeline display"

### Task 3.4: Mobile-Friendly Styling

- [x] Add responsive CSS for mobile screens
- [x] Test layout works on phone-sized viewport

**Commit**: "Add mobile-responsive styling" ✅ **COMPLETED**

---

## Phase 4: AI Integration

**Goal**: Add OpenAI summarization to replace basic summaries

### Task 4.1: OpenAI Client Setup

- [x] Add OpenAI dependency
- [x] Create AI service class with API key from environment
- [x] Test basic API call with simple prompt

**Commit**: "Add OpenAI client integration" ✅ **COMPLETED**

### Task 4.2: Hacker News Summarization & Classification

- [x] Define user interest statements (keywords/weights) for AI/LLM and AI-for-software-dev
- [x] Replace basic summaries with AI-generated ones for HN items
- [x] Classify relevance and set a `highlight` flag in metadata

**Commit**: "Add AI summarization and relevance for HN stories" ✅ **COMPLETED**

### Task 4.3: Error Handling

- [x] Add try/catch around AI calls
- [x] Fall back to basic summary when AI fails
- [x] Log AI failures to console

**Commit**: "Add AI error handling and fallbacks"

### Task 4.4: Basic Cost Tracking

- [x] Create ai_usage table
- [x] Track tokens and estimated cost per request
- [x] Add simple daily budget check

**Commit**: "Add basic AI cost tracking"

---

## Phase 5: Automated Scheduling

**Goal**: Run collection automatically without manual triggers

### Task 5.1: Cron Setup

- [x] Add node-cron dependency
- [x] Create basic scheduled job that runs every minute (for testing)
- [x] Log when job executes

**Commit**: "Add basic cron job scheduling" ✅ **COMPLETED**

### Task 5.2: Collection Job

- [x] Move Hacker News collection logic to scheduled job
- [x] Schedule daily at 6 AM
- [x] Test job runs automatically
- [x] Add ability for user to manually refresh/fetch new items within the interface

**Commit**: "Add automated Hacker News collection job" ✅ **COMPLETED**

---

## Phase 6: Polish & Optimization

**Goal**: Add the refinements that make it pleasant to use

### Task 6.1: API Rate Limiting

- [x] Add minimal delays/backoff between external API calls (Algolia/Firebase)
- [ ] Verify no rate limit errors during daily runs

**Commit**: "Add external API rate limiting"

### Task 6.3: Frontend Polish

- [x] Add loading spinner while fetching data
- [x] Add manual refresh button
- [x] Improve error display when no data available

**Commit**: "Improve frontend UX with loading states" ✅ **COMPLETED**

### Task 6.4: Citation Links

- [x] Add markdown rendering for summaries
- [x] Test clickable links in summaries

**Commit**: "Add markdown rendering and citation links" ✅ **COMPLETED**

---

## Phase 7: Configuration & Deployment

**Goal**: Make it easy to configure and deploy

### Task 7.1: Environment Configuration

- [ ] Create .env.example file with all required variables
- [ ] Add validation for required environment variables
- [ ] Document setup process

**Commit**: "Add environment configuration and validation"

### Task 7.2: Initial Sync Command

- [ ] Add command line flag for initial HN sync
- [ ] Fetch last 1-2 days of HN stories on first run
- [ ] Document usage in README

**Commit**: "Add initial HN sync functionality"

---

## Phase 8: Advanced Filtering & Ranking System

**Goal**: Replace binary highlight system with intelligent multi-pass ranking that learns from user feedback

### Task 8.1: Implement Advanced Filtering & Ranking (Spec-Driven)
- [ ] Implement the complete system as detailed in `/planning/features/filter_rank_system.md` (Updated September 10, 2025)
- [ ] Apply the Prototyping Data Policy as needed (reset DB instead of migrations)
- [ ] Ensure per-topic keywords and negative keywords are respected across discovery, scoring, and UI

**Commit**: "Implement advanced filtering and ranking system (see feature spec)"

---

## Development Guidelines

### Small Task Approach

- Complete one small task at a time
- Test each task thoroughly before moving on
- Commit after each completed task
- Get confirmation before proceeding to next task

### Testing Strategy

- Manual testing for each task
- Use real Discord servers (with permission)
- Test with actual OpenAI API calls
- Verify mobile responsiveness manually

### Technical Decisions

- **Database**: Start with simple SQLite file
- **Error Handling**: Console logging initially, improve in later phases
- **Rate Limiting**: Skip until Phase 6 to avoid complexity
- **Configuration**: Minimal env/config; no API keys required for HN

### Task Completion Criteria

Each task must:

1. Have working code that can be demonstrated
2. Include basic error handling (at minimum console.log)
3. Be tested with real data where applicable
4. Be committed with descriptive commit message

### Extension Points (Future Phases)

- **Phase 9+**: Add new content sources (Discord, Bluesky)
- **Phase 10+**: Advanced ML features (active learning, ensemble methods)

## Success Metrics by Phase

- **Phase 3**: Can see filtered Hacker News data in browser
- **Phase 4**: AI summaries are meaningful and helpful
- **Phase 5**: System updates automatically without intervention
- **Phase 6**: Pleasant to use daily, no maintenance needed
- **Phase 7**: Easy to set up on new machine/server
- **Phase 8**: Content ranking significantly improves with user feedback, keyboard shortcuts make rating effortless

---

## Implementation Notes

- Store cleaned Hacker News page text in DB (`page_text`) and include it in backend search.
- HN collector now prefers `firebase.text`; otherwise fetches URL text (text content-types only), cleans and truncates to `CONTENT_CHAR_LIMIT`.
- Added simple per-domain rate limiting and env-configurable fetch limits (`FETCH_TIMEOUT_MS`, `FETCH_MAX_RETRIES`, `DOMAIN_RATE_LIMIT_MS`, `TEXT_CONTENT_TYPES`).
- Summarization policy unchanged: only for highlighted items, using `page_text` when available.

- Hacker News collection now merges Top stories with recent (last 24h) keyword-matched stories; hydrated via Firebase and filtered by a score threshold (`minPoints`, default 20).
- Configuration: `backend/config/user-settings.json` supports `minPoints`; can be overridden via `HN_MIN_POINTS`. Merged results are truncated to `maxItems`.
- Job and ingest now call `discoverTopAndRecentWithMinScore({ maxItems, minPoints })`. Top stories are not keyword-filtered; only the score threshold applies.

---

## Notes

- This application is single-user only. Favorites are stored directly on `content_items`.
- Favoriting sets and persists a tier-4 rating for the active research statement; users can later change the rating via the relevance dot.
- Multiple research topics are supported. Each topic has a title, research statement, and its own keyword filters. The dashboard can be filtered by `research_statement_id`.
