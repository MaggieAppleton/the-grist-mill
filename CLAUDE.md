# Micro Mode Workflow

When I request a single incremental change to this project, follow this EXACT process:

## Step 1: Analysis Phase (NO CODE YET)

- Present 2-3 different approaches to solve the problem
- For each approach, explain:
  - Implementation strategy
  - Files that would be modified
  - Pros/cons specific to React
  - CSS implications

## Step 2: Approach Selection & Planning

- Wait for my approach selection
- Use TodoWrite tool to create detailed implementation plan
- Break down into specific, testable steps
- Identify any new dependencies needed

## Step 3: Code Review Preparation

- Draft the code but ask for review before implementing
- Point out CSS decisions
- Identify what should be tested and how

## Step 4: Implementation & Testing

- Implement only after review approval
- I will test functionality manually in browser
- Run these commands automatically:
  - `npm run lint` (if available)
  - `npm run type-check` (if available)
  - `npm run test` (if available)
  - `npm run build` (if available)
- Fix any linting, type, or build errors

## Step 5: Commit & Next Steps

- Write conventional commit message (feat:, fix:, refactor:, etc.)
- Show me the commit message before committing
- Commit only when I explicitly approve
- Suggest 2-3 logical next incremental improvements

## Project Context

- **Tech Stack**: Node.js + Express, SQLite, React (Vite)
- **Backend**: Express API with SQLite persistence
- **Frontend**: React + Vite (JavaScript)
- **State Management**: React hooks
- **Key Dependencies**: express, sqlite3, react, vite
- **Testing**: Manual for now (no Jest configured yet)

## Quick Architecture Notes

- **Backend** (`backend/server.js`): `GET /api/health`, `GET /api/items` with `source`, `limit`, `offset`; `POST /api/collectors/hackernews` to ingest HN.
- **Database** (`backend/database.js`): `content_items` unique `(source_type, source_id)`; stores `title`, `summary`, `raw_content`, `url`, timestamps.
- **Collector** (`backend/collectors/hackernews.js`): Discover via Algolia (last 24h, AI/LLM keywords), hydrate via Firebase; simple delays.
- **Frontend** (`frontend/`): `src/services/api.js` fetches `/api/items`; `src/App.jsx` renders a timeline list.

## Recent Development History

- Backend foundation with SQLite schema and basic endpoints.
- Hacker News collector with manual trigger; items persisted.
- React dashboard wired to API; mobile polish pending.

## Testing Notes

- Backend: Verify `GET /api/health`, `GET /api/items`, and `POST /api/collectors/hackernews` insert items.
- Frontend: Confirm list renders title, summary, and time; test loading/error states.
- Keep changes small and test manually per task.

## Available Commands

- `npm run dev` runs both front and backend
- Backend: `node backend/server.js`
- Frontend: `cd frontend && npm run dev` | `npm run build` | `npm run preview` | `npm run lint`
- Trigger HN ingest: `curl -X POST http://localhost:3001/api/collectors/hackernews`
  <!-- Current mode: micro -->
  <!-- Phase: foundation -->
