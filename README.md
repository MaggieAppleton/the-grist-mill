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

## API

- `GET /api/health`
- `GET /api/items?limit=50&offset=0&source=hackernews`
