# The Grist Mill - Implementation Plan

Updated: August 15th, 2025 at 8:39am

## Overview

This plan breaks down the implementation into focused phases, prioritizing getting data on the page quickly before adding refinements. Each phase should result in a working system.

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

## Phase 2: Basic Discord Data Collection

**Goal**: Collect real Discord messages and store them (without AI processing yet)

### Task 2.1: Discord Client Setup

- [ ] Add Discord.js dependency
- [ ] Create Discord client with bot token from environment
- [ ] Test connection to Discord (console log success)

**Commit**: "Add Discord.js client connection"

### Task 2.2: Basic Message Fetching

- [ ] Implement function to fetch messages from single channel
- [ ] Test with one hardcoded channel ID
- [ ] Log fetched messages to console

**Commit**: "Add basic Discord message fetching"

### Task 2.3: Store Discord Messages

- [ ] Create function to convert Discord message to content_item format
- [ ] Store single channel's messages in database
- [ ] Create simple summary text (e.g., "5 messages from #general")

**Commit**: "Store Discord messages in database"

### Task 2.4: Manual Collection Endpoint

- [ ] Add `POST /api/collectors/discord` endpoint
- [ ] Trigger collection manually via API call
- [ ] Return success/failure status

**Commit**: "Add manual Discord collection trigger"

---

## Phase 3: Basic Frontend Dashboard

**Goal**: Display collected data in a simple, clean interface

### Task 3.1: React App Setup

- [ ] Create React app in `/frontend` directory
- [ ] Start development server on port 3000
- [ ] Remove default content, create empty dashboard component

**Commit**: "Initialize React frontend"

### Task 3.2: API Client

- [ ] Create API client function to fetch items from backend
- [ ] Test API call returns data in React component
- [ ] Display raw JSON data on page

**Commit**: "Add API client and data fetching"

### Task 3.3: Basic Timeline Layout

- [ ] Create simple list component to display content items
- [ ] Show title, summary, and timestamp for each item
- [ ] Add basic CSS for readability

**Commit**: "Add basic timeline display"

### Task 3.4: Mobile-Friendly Styling

- [ ] Add responsive CSS for mobile screens
- [ ] Test layout works on phone-sized viewport

**Commit**: "Add mobile-responsive styling"

---

## Phase 4: AI Integration

**Goal**: Add OpenAI summarization to replace basic summaries

### Task 4.1: OpenAI Client Setup

- [ ] Add OpenAI dependency
- [ ] Create AI service class with API key from environment
- [ ] Test basic API call with simple prompt

**Commit**: "Add OpenAI client integration"

### Task 4.2: Discord Summarization

- [ ] Create Discord-specific summarization prompt
- [ ] Replace basic summaries with AI-generated ones
- [ ] Test with real Discord message data

**Commit**: "Add AI summarization for Discord messages"

### Task 4.3: Error Handling

- [ ] Add try/catch around AI calls
- [ ] Fall back to basic summary when AI fails
- [ ] Log AI failures to console

**Commit**: "Add AI error handling and fallbacks"

### Task 4.4: Basic Cost Tracking

- [ ] Create ai_usage table
- [ ] Track tokens and estimated cost per request
- [ ] Add simple daily budget check

**Commit**: "Add basic AI cost tracking"

---

## Phase 5: Automated Scheduling

**Goal**: Run collection automatically without manual triggers

### Task 5.1: Cron Setup

- [ ] Add node-cron dependency
- [ ] Create basic scheduled job that runs every minute (for testing)
- [ ] Log when job executes

**Commit**: "Add basic cron job scheduling"

### Task 5.2: Collection Job

- [ ] Move Discord collection logic to scheduled job
- [ ] Change schedule to daily at 6 AM
- [ ] Test job runs automatically

**Commit**: "Add automated Discord collection job"

### Task 5.3: Job Tracking

- [ ] Create collector_runs table
- [ ] Record job start/completion status
- [ ] Add endpoint to view job history

**Commit**: "Add job execution tracking"

---

## Phase 6: Polish & Optimization

**Goal**: Add the refinements that make it pleasant to use

### Task 6.1: Discord Rate Limiting

- [ ] Add 100ms delays between Discord API calls
- [ ] Test with multiple channels to ensure no rate limit errors

**Commit**: "Add Discord API rate limiting"

### Task 6.2: Budget Protection

- [ ] Implement daily budget checking before AI calls
- [ ] Stop processing when budget exceeded
- [ ] Log budget status

**Commit**: "Add daily AI budget protection"

### Task 6.3: Frontend Polish

- [ ] Add loading spinner while fetching data
- [ ] Add manual refresh button
- [ ] Improve error display when no data available

**Commit**: "Improve frontend UX with loading states"

### Task 6.4: Citation Links

- [ ] Add markdown rendering for summaries
- [ ] Include Discord message links in AI prompts
- [ ] Test clickable links in summaries

**Commit**: "Add markdown rendering and citation links"

---

## Phase 7: Configuration & Deployment

**Goal**: Make it easy to configure and deploy

### Task 7.1: Environment Configuration

- [ ] Create .env.example file with all required variables
- [ ] Add validation for required environment variables
- [ ] Document setup process

**Commit**: "Add environment configuration and validation"

### Task 7.2: Initial Sync Command

- [ ] Add command line flag for initial Discord sync
- [ ] Fetch last 1-2 days of messages on first run
- [ ] Document usage in README

**Commit**: "Add initial sync functionality"

### Task 7.3: Multi-Server Support

- [ ] Update Discord collector to handle multiple servers
- [ ] Add channel exclusion filtering
- [ ] Test with configured servers from environment

**Commit**: "Add multi-server Discord collection"

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
- **Configuration**: Environment variables from Phase 1

### Task Completion Criteria

Each task must:

1. Have working code that can be demonstrated
2. Include basic error handling (at minimum console.log)
3. Be tested with real data where applicable
4. Be committed with descriptive commit message

### Extension Points (Future Phases)

- **Phase 8+**: Add new content sources (Hacker News, Bluesky)
- **Phase 9+**: Add filtering and search capabilities
- **Phase 10+**: Improve AI prompts and add source-specific handling

## Success Metrics by Phase

- **Phase 3**: Can see Discord data in browser
- **Phase 4**: AI summaries are meaningful and helpful
- **Phase 5**: System updates automatically without intervention
- **Phase 6**: Pleasant to use daily, no maintenance needed
- **Phase 7**: Easy to set up on new machine/server
