# Advanced Filtering and Ranking System

Updated: September 5, 2025

## Overview

This document outlines the implementation of an advanced multi-pass filtering and ranking system for The Grist Mill. The system will replace the current simple binary highlight/non-highlight approach with a sophisticated weighted scoring system that learns from user feedback and compares content against user-defined research statements.

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
3. **Multi-Category Support**: Support multiple research statements for different focus areas
4. **Frictionless Feedback**: Easy keyboard shortcuts for rapid relevance rating
5. **Extensible Architecture**: Support future content sources beyond Hacker News

## Architecture Overview

### Multi-Pass Filtering Pipeline

**Pass 1: Keyword Filtering (Pre-AI)**
- Continue existing keyword-based discovery
- Cheap elimination of obvious noise
- Expand to post-processing keyword scoring

**Pass 2: Research Statement Matching**
- Use embeddings to compare content against user research statements
- Generate 4-tier relevance scores: Very Relevant, Relevant, Weakly Relevant, Not Relevant
- Store embedding similarities for future reference

**Pass 3: Feedback-Informed Ranking**
- Apply learned patterns from historical user ratings
- Boost/penalize based on similarity to previously rated content
- Combine with embedding scores for final ranking

### Hybrid Scoring Formula

```
Final Score = (0.3 × keyword_score) + (0.4 × embedding_similarity) + (0.3 × feedback_score)
```

Weights can be tuned based on performance and user preference.

## Database Schema Extensions

### New Tables

```sql
-- User research statements (supports multiple categories)
CREATE TABLE research_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL,               -- "AI/LLM Research", "End-User Programming"
  statement TEXT NOT NULL,                  -- Full research interest description
  embedding BLOB,                           -- Cached embedding of statement
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
  keyword_score REAL,                       -- Keyword matching score
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
```

## Implementation Phases

### Phase 8A: Research Statement Management

**Goal**: Allow users to create and manage multiple research statements

#### Task 8A.1: Backend Research Statement API
- [ ] Create research statement CRUD endpoints
- [ ] Add validation for statement text (min/max length)
- [ ] Support for activating/deactivating statements
- [ ] Default research statement creation

**Commit**: "Add research statement management API"

#### Task 8A.2: Frontend Research Statement UI
- [ ] Settings page for managing research statements
- [ ] Form for creating/editing statements
- [ ] Toggle for active/inactive statements
- [ ] Validation and error handling

**Commit**: "Add research statement management UI"

#### Task 8A.3: Statement Embedding Generation
- [ ] Generate embeddings for research statements on create/update
- [ ] Cache embeddings in database
- [ ] Add re-generation endpoint for testing

**Commit**: "Add embedding generation for research statements"

---

### Phase 8B: Content Embeddings and Similarity

**Goal**: Generate embeddings for content and compute similarity scores

#### Task 8B.1: Content Embedding Service
- [ ] Extract content text from items (title + first 500 chars of content/summary)
- [ ] Generate embeddings using OpenAI text-embedding-3-small
- [ ] Store embeddings in content_features table
- [ ] Add batch processing for existing content

**Commit**: "Add content embedding generation"

#### Task 8B.2: Similarity Calculation
- [ ] Implement cosine similarity calculation
- [ ] Compute similarity between content and active research statements
- [ ] Store similarity scores in content_features table
- [ ] Add threshold-based relevance tier assignment

**Commit**: "Add content-research statement similarity scoring"

#### Task 8B.3: Integration with Content Collection
- [ ] Generate embeddings and similarity scores during HN collection
- [ ] Update existing content items with embeddings
- [ ] Test with real HN data

**Commit**: "Integrate embedding generation with content collection"

---

### Phase 8C: User Feedback System

**Goal**: Capture and store user relevance ratings

#### Task 8C.1: Feedback API Endpoints
- [ ] POST /api/feedback/rate endpoint for rating items
- [ ] GET /api/feedback/stats for user's rating history
- [ ] Support for multiple research statements per item
- [ ] Validation and duplicate handling

**Commit**: "Add user feedback API endpoints"

#### Task 8C.2: Frontend Rating Interface
- [ ] Rating buttons/controls on each content item
- [ ] Keyboard shortcuts (1-4 keys for rating tiers)
- [ ] Visual feedback for rated items
- [ ] Bulk rating capabilities

**Commit**: "Add user rating interface with keyboard shortcuts"

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
- [ ] Update API endpoints to sort by final_score
- [ ] Add filtering by relevance tier
- [ ] Update frontend to display relevance indicators
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

## User Interface Design

### Content Item Display

Each content item will show:
- **Relevance Badge**: Color-coded tier indicator (Very Relevant = Green, etc.)
- **Score Display**: Numerical score (optional, for power users)
- **Rating Controls**: 1-4 number buttons or star-style rating
- **Research Statement**: Which statement this ranking is for

### Keyboard Shortcuts

- **1-4 Keys**: Rate current item (1=Not Relevant, 4=Very Relevant)
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

### System Performance
- **Response Time**: Dashboard load time under 2 seconds
- **Cost Efficiency**: Daily embedding/ranking costs under budget
- **Feedback Coverage**: % of content items with user ratings

### User Experience
- **Daily Usage**: Consistent engagement with dashboard
- **Rating Efficiency**: Average time to rate items (target: <5 seconds)
- **Accuracy Improvement**: Ranking quality improvement over time

## Future Enhancements

### Advanced ML Features
- **Active Learning**: Suggest items for user to rate that would improve model most
- **Ensemble Methods**: Combine multiple ranking algorithms
- **Temporal Patterns**: Learn user's changing interests over time

### Multi-Modal Content
- **Image Analysis**: Process images in HN posts for additional ranking signals
- **Link Content**: Analyze linked article content for better relevance scoring
- **Comment Analysis**: Factor in HN comment quality and relevance

### Social Features
- **Collaborative Filtering**: Learn from similar users' preferences (privacy-preserving)
- **Expert Recommendations**: Weight ratings from domain experts higher
- **Community Research Statements**: Share and adapt research statements across users