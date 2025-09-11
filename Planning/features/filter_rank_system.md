# Advanced Filtering and Ranking System

Updated: September 11, 2025

## Overview

This document outlines the implementation of an advanced multi-pass filtering and ranking system for The Grist Mill. The system will replace the current simple binary highlight/non-highlight approach with a sophisticated weighted scoring system that learns from user feedback and compares content against user-defined research statements.

## Prototyping Data Policy (No Migrations)

- This project is in prototyping. Data persistence is not required across schema changes.
- We will not write database migrations during this phase. When schema changes are needed, we will reset the SQLite database (drop and recreate tables or delete the DB file) to match the latest schema.
- Current backend (`backend/database.js`) already drops and recreates `content_items` if required columns are missing. We will extend this approach as new tables/columns are introduced for this feature (e.g., `research_statements`, `user_ratings`, `content_features`, and favorites columns).
- Operational guidance: When applying schema updates from this spec, stop the server, delete `backend/grist_mill.db`, restart the backend to reinitialize with the new schema, and re-run collectors.

## Current System Limitations

The existing system uses:

1. Keyword-based discovery via Algolia HN Search
2. Single-pass AI classification with binary highlight flag
3. No user feedback mechanism
4. No personalization or learning

Problems:

- Items ranked as "highlights" often aren't truly relevant to research goals
- No way to improve ranking accuracy over time
- No support for multiple research interests
- Binary classification is too simplistic

## Goals

1. **High Signal Content**: Surface only the most relevant items for user's research interests
2. **Continuous Learning**: Improve ranking accuracy through user feedback
3. **Multi-Topic Support**: Support multiple research topics, each with its own title, keyword filters, and research statement; each topic has its own dashboard view
4. **Frictionless Feedback**: Easy keyboard shortcuts for rapid relevance rating
5. **Extensible Architecture**: Support future content sources beyond Hacker News
6. **Favorites for Personal Curation**: Allow users to mark items as favorites (hearts) for quick recall, independent of system ranking

## Architecture Overview

### Multi-Pass Filtering Pipeline

**Pass 1: Keyword Filtering (Pre-AI)**

- Continue existing keyword-based discovery
- Cheap elimination of obvious noise
- Expand to post-processing keyword scoring
- Apply keyword filtering per research topic: each topic defines its own keyword list (and optional negative keywords). Keyword scores are computed using the active topic’s lists.

**Pass 2: Research Statement Matching**

- Use embeddings to compare content against the active topic’s research statement
- Generate 4-tier relevance scores: Very Relevant, Relevant, Weakly Relevant, Not Relevant
- Store embedding similarities for future reference

**Pass 3: Feedback-Informed Ranking**

- Apply learned patterns from historical user ratings
- Boost/penalize based on similarity to previously rated content
- Combine with embedding scores for final ranking

### Hybrid Scoring Formula

```
Final Score (per topic) = (0.3 × keyword_score_topic) + (0.4 × embedding_similarity_topic) + (0.3 × feedback_score_topic)
```

Weights can be tuned based on performance and user preference.

## Database Schema Extensions

### New Tables

```sql
-- User research statements (supports multiple categories)
CREATE TABLE research_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,               -- Topic title, e.g., "AI/LLM Research"
  statement TEXT NOT NULL,                  -- Topic research statement/description
  embedding BLOB,                           -- Cached embedding of statement
  keywords TEXT,                            -- JSON array of keyword strings (positive)
  negative_keywords TEXT,                   -- JSON array of keyword strings to exclude (optional)
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User feedback on content relevance
CREATE TABLE user_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL,
  research_statement_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,                  -- 4=Very Relevant, 3=Relevant, 2=Weakly Relevant, 1=Not Relevant
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_item_id) REFERENCES content_items(id),
  FOREIGN KEY (research_statement_id) REFERENCES research_statements(id),
  UNIQUE(content_item_id, research_statement_id)
);

-- Computed content features for ranking
CREATE TABLE content_features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_item_id INTEGER NOT NULL,
  research_statement_id INTEGER NOT NULL,
  content_embedding BLOB,                   -- Cached embedding of title + content
  similarity_score REAL,                    -- Cosine similarity to research statement
  keyword_score REAL,                       -- Keyword matching score (computed per topic keywords)
  feedback_score REAL,                      -- Score based on similar item ratings
  final_score REAL,                         -- Combined weighted score
  relevance_tier INTEGER,                   -- 1-4 tier based on final_score
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (content_item_id) REFERENCES content_items(id),
  FOREIGN KEY (research_statement_id) REFERENCES research_statements(id),
  UNIQUE(content_item_id, research_statement_id)
);

CREATE INDEX idx_content_features_score ON content_features(research_statement_id, final_score DESC);
CREATE INDEX idx_user_ratings_lookup ON user_ratings(content_item_id, research_statement_id);
```

### Modified Tables

```sql
-- Add ranking fields to existing content_items table
ALTER TABLE content_items ADD COLUMN primary_research_statement_id INTEGER;
ALTER TABLE content_items ADD COLUMN best_relevance_tier INTEGER DEFAULT 1;
ALTER TABLE content_items ADD COLUMN best_final_score REAL DEFAULT 0.0;

-- Favorites (heart/bookmark) support for single-user app
ALTER TABLE content_items ADD COLUMN is_favorite BOOLEAN DEFAULT 0; -- 0=false, 1=true
ALTER TABLE content_items ADD COLUMN favorited_at DATETIME;         -- when user hearted
```

Notes:

- This application is single-user only. Favorites are stored directly on `content_items`; there is no multi-user model.
- When `is_favorite` is set to true, the system also persists a relevance rating of 4 (Very Relevant) for the active research statement and updates any cached best-tier fields accordingly.
- During prototyping, when adding these columns, we will reset the database (no migration). See Prototyping Data Policy above.

### Backend Initialization Changes (database.js)

- We will not run the above `ALTER TABLE` statements at runtime. They describe the target schema. Actual behavior in `backend/database.js` will:
  - Create `content_items` with all new columns from the start: `primary_research_statement_id`, `best_relevance_tier`, `best_final_score`, `is_favorite`, `favorited_at`.
  - Create new tables `research_statements`, `user_ratings`, and `content_features`, plus their indexes, using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
  - `research_statements.keywords` and `negative_keywords` are stored as JSON arrays (TEXT). Validation occurs at the API layer.
  - Extend the existing schema guard to require the new `content_items` columns; if any required column is missing, drop and recreate `content_items` automatically on startup.
  - For simplicity during prototyping, if non-trivial shape changes are needed to new tables, delete `backend/grist_mill.db` and restart to reinitialize everything cleanly.

## Implementation Phases

### Phase 8A: Research Topic Management

**Goal**: Allow users to create and manage multiple research topics (title, keywords, negative keywords, research statement)

#### Task 8A.1: Backend Research Topic API

- [x] Create research statement CRUD endpoints (name/title, statement, keywords, negative_keywords, is_active)
- [x] Add validation for statement text (min/max length) and keyword arrays (array of non-empty strings)
- [x] Support for activating/deactivating topics
- [x] Default research topic creation

**Commit**: "Add research topic management API" ✅ COMPLETED (September 10, 2025)

#### Task 8A.2: Frontend Research Topic UI

- [x] Settings page for managing research topics
- [x] Form for creating/editing: title, research statement, keywords, negative keywords
- [x] Toggle for active/inactive topics
- [x] Validation and error handling

**Commit**: "Add research topic management UI" ✅ COMPLETED (September 10, 2025)

Follow-up:

- Improve Settings modal design and information architecture (multi-panel or tabs; better hierarchy; tighter spacing).

#### Task 8A.3: Statement Embedding Generation

- [x] Generate embeddings for research statements on create/update
- [x] Cache embeddings in database
- [x] Add re-generation endpoint for testing

**Commit**: "Add embedding generation for research statements" ✅ COMPLETED (September 11, 2025)

---

### Phase 8B: Content Embeddings and Similarity

**Goal**: Generate embeddings for content and compute similarity scores

#### Task 8B.1: Content Embedding Service

- [x] Extract content text from items (title + first 500 chars of content/summary)
- [x] Generate embeddings using OpenAI text-embedding-3-small
- [x] Store embeddings in content_features table
- [x] Add batch processing for existing content

**Commit**: "Add content embedding generation"

#### Task 8B.2: Similarity Calculation

- [x] Implement cosine similarity calculation
- [x] Compute similarity between content and active topics’ research statements
- [x] Store similarity scores in content_features table
- [x] Add threshold-based relevance tier assignment

**Commit**: "Add content-research statement similarity scoring" ✅ COMPLETED (September 11, 2025)

#### Task 8B.3: Integration with Content Collection

- [ ] Generate embeddings and similarity scores during HN collection
- [ ] Update existing content items with embeddings
- [ ] Test with real HN data

**Commit**: "Integrate embedding generation with content collection"

---

### Phase 8C: User Feedback System

**Goal**: Capture and store user relevance ratings and favorites

#### Task 8C.1: Feedback API Endpoints

- [ ] POST /api/feedback/rate endpoint for rating items
- [ ] GET /api/feedback/stats for user's rating history
- [ ] Support for multiple research statements per item
- [ ] Validation and duplicate handling

**Commit**: "Add user feedback API endpoints"

#### Task 8C.1b: Favorites API Endpoints

- [ ] POST /api/favorites/toggle to heart/unheart an item
- [ ] Toggling favorite to true must also persist rating=4 for the active research statement
- [ ] GET /api/favorites?only=true to list favorited items (optional convenience)

**Commit**: "Add favorites (heart) API endpoints"

#### Task 8C.2: Frontend Rating Interface

- [ ] Relevance dot control on each content item
- [ ] Dropdown menu with 4 options (Not, Weakly, Relevant, Very Relevant)
- [ ] Keyboard shortcuts (1-4 keys) for rating tiers
- [ ] Visual feedback for rated items

**Commit**: "Add user rating interface with relevance dot and keyboard shortcuts"

#### Task 8C.2b: Favorites UI

- [ ] Heart icon next to relevance dot; toggles favorite
- [ ] Favoriting sets the rating to Very Relevant (tier 4) and persists it
- [ ] Filter switch on dashboard to show only favorites

**Commit**: "Add favorites UI and dashboard filter"

#### Task 8C.3: Rating History and Analytics

- [ ] Show user's rating history in settings
- [ ] Basic analytics on rating patterns
- [ ] Export ratings data functionality

**Commit**: "Add rating history and analytics"

---

### Phase 8D: Feedback-Informed Ranking

**Goal**: Use user feedback to improve future rankings

#### Task 8D.1: Similarity-Based Feedback Scoring

- [ ] Find similar content items (by embeddings) that user has rated
- [ ] Weight feedback based on similarity distance
- [ ] Compute feedback score for unrated items
- [ ] Store feedback scores in content_features table

**Commit**: "Add feedback-based scoring using content similarity"

#### Task 8D.2: Hybrid Score Calculation

- [ ] Combine keyword, similarity, and feedback scores
- [ ] Implement weighted scoring formula
- [ ] Update relevance tiers based on combined scores
- [ ] Add configurable weights for score components

**Commit**: "Implement hybrid scoring algorithm"

#### Task 8D.3: Score-Based Content Sorting

- [ ] Update API endpoints to sort by final_score per topic (filter by `research_statement_id`)
- [ ] Add filtering by relevance tier and by favorites
- [ ] Update frontend to display relevance indicators and heart state
- [ ] Test improved ranking accuracy

**Commit**: "Add score-based content ranking and filtering"

---

### Phase 8E: Multi-Statement Dashboard Support

**Goal**: Support filtering and ranking by different research statements

#### Task 8E.1: Statement Selection Interface

- [ ] Dropdown/tabs for selecting active research statement
- [ ] Show content filtered by selected statement
- [ ] Update URLs to include statement parameter
- [ ] Remember user's last selected statement

**Commit**: "Add multi-statement dashboard filtering"

#### Task 8E.2: Statement-Specific Analytics

- [ ] Show ranking performance per research statement
- [ ] Content distribution charts by relevance tier
- [ ] Feedback coverage statistics
- [ ] Cost tracking per statement

**Commit**: "Add per-statement analytics and reporting"

#### Task 8E.3: Batch Re-ranking

- [ ] Re-calculate scores when research statements change
- [ ] Background job for re-ranking existing content
- [ ] Progress tracking for large re-ranking operations
- [ ] Optimization to only re-rank when needed

**Commit**: "Add batch re-ranking capabilities"

---

## API Specifications

### Research Statement Endpoints

```
GET /api/research-statements
POST /api/research-statements
PUT /api/research-statements/:id
DELETE /api/research-statements/:id
POST /api/research-statements/:id/regenerate-embedding
```

### Content Filtering Endpoints

```
GET /api/items?research_statement_id=123&min_tier=3&limit=50
GET /api/items?research_statement_id=123&sort=score_desc
GET /api/items?favorites_only=true                          -- returns only favorites
```

### Feedback Endpoints

```
POST /api/feedback/rate
{
  "content_item_id": 123,
  "research_statement_id": 456,
  "rating": 4
}

GET /api/feedback/stats?research_statement_id=456
```

### Favorites Endpoints

```
POST /api/favorites/toggle
{
  "content_item_id": 123,
  "is_favorite": true
}
-- If is_favorite becomes true, also persist rating=4 for the active research statement
```

## User Interface Design

### Content Item Display

Each content item will show:

- **Relevance Dot**: Color-coded dot to the left of the source badge. Clicking opens a dropdown to choose among 4 tiers. Colors: Not Relevant = Gray; Weakly Relevant = Light Green; Relevant = Medium Green; Very Relevant = Dark Green (using saturation/opacity to distinguish tiers).
- **Heart (Favorite) Icon**: Next to the relevance dot. Clicking toggles favorite state (filled heart when active) and sets rating to Very Relevant (tier 4).
- **Research Statement Icon**: Icon in the bottom right. When hovered, shows which research statement this ranking pertains to. Use the relevant research statement name.

### Relevance Dropdown Menu

- Opens when clicking the relevance dot or pressing a shortcut to open rating menu
- Shows four options with leading colored dots and labels: Not Relevant (1), Weakly Relevant (2), Relevant (3), Very Relevant (4)
- Selecting an option posts rating immediately and updates UI state

### Keyboard Shortcuts

- **1-4 Keys**: Rate current item (1=Not Relevant, 4=Very Relevant)
- **F Key**: Toggle favorite (heart) for current item (sets rating to 4 when favorited)
- **J/K Keys**: Navigate up/down timeline
- **R Key**: Refresh/reload content
- **S Key**: Open research statement selector
- **? Key**: Show keyboard shortcut help

### Research Statement Management

- **Settings Page**: CRUD interface for research statements
- **Statement Editor**: Rich text editor for detailed research descriptions
- **Active Toggles**: Enable/disable statements without deletion
- **Performance Metrics**: Show how well each statement is performing

## Cost Optimization Strategy

### Initial Phase (Higher Cost for Learning)

- **Budget**: $1/day for embeddings + ranking
- **Priority**: Get sufficient training data through user feedback
- **Approach**: Generate embeddings for all content, compute similarities frequently

### Optimization Phase (Cost Reduction)

- **Caching**: Store embeddings and only regenerate when content/statements change
- **Batching**: Bulk embedding generation to reduce API calls
- **Selective Processing**: Only rank content above minimum keyword threshold
- **Model Optimization**: Test smaller/cheaper embedding models

## Success Metrics

### Ranking Quality

- **User Satisfaction**: % of "Very Relevant" items rated as actually relevant
- **Discovery Rate**: % of relevant content surfaced vs missed
- **Feedback Volume**: User engagement with rating system
- **Favorites Usage**: # of favorited items and revisit rate

### System Performance

- **Response Time**: Dashboard load time under 2 seconds
- **Cost Efficiency**: Daily embedding/ranking costs under budget
- **Feedback Coverage**: % of content items with user ratings

### User Experience

- **Daily Usage**: Consistent engagement with dashboard
- **Rating Efficiency**: Average time to rate items (target: <5 seconds)
- **Accuracy Improvement**: Ranking quality improvement over time
- **Favorite Recall**: Time to locate favorited items (target: instant via filter)
