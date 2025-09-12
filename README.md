# The Grist Mill

Local dashboard that aggregates content (currently Hacker News) into a clean timeline.

## Development

- Install deps:

  ```bash
  npm install
  cd backend && npm install
  cd ../frontend && npm install
  ```

- Start both servers:
  ```bash
  npm run dev
  ```
  - Backend: http://localhost:3001
  - Frontend: http://localhost:5173

If port 5173 is busy, Vite will fail fast due to strictPort; free the port or change `frontend/vite.config.js`.

## Build

- Frontend production build:
  ```bash
  cd frontend
  npm run build
  ```

## Configuration

User settings for Hacker News collection (keywords, max items) can be configured through the web UI settings modal (⚙️ button) or by editing `backend/config/user-settings.json`.

## Seeding the database (Hacker News)

- To seed recent HN stories (uses HN publish time for `created_at`, so columns reflect publish days):

  ```bash
  node backend/scripts/seed_hn_recent.js --hours=72 --max=200
  ```

- How it works:
  - Stories are discovered via Algolia and/or Firebase and hydrated from the Firebase API.
  - We set `content_items.created_at` from HN’s `time` field (publish timestamp), not the fetch time, so the frontend timeline groups items by the actual day they were posted.

- Optional reset before reseeding:

  ```bash
  sqlite3 backend/grist_mill.db "DELETE FROM content_features; DELETE FROM user_ratings; DELETE FROM content_items; VACUUM;"
  ```

## API

- `GET /api/health`
- `GET /api/items?limit=50&offset=0&source=hackernews`
- `GET /api/settings` - Get current user settings
- `PUT /api/settings` - Update user settings
