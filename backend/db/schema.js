const { db } = require("./connection");

function initializeDatabase() {
	return new Promise((resolve, reject) => {
		const createContentItemsTable = `
			CREATE TABLE IF NOT EXISTS content_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_type TEXT NOT NULL,
				source_id TEXT NOT NULL,
				title TEXT,
				summary TEXT,
				page_text TEXT,
				raw_content TEXT,
				url TEXT,
				highlight BOOLEAN DEFAULT 0,
				is_favorite BOOLEAN DEFAULT 0,
				favorited_at DATETIME,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(source_type, source_id)
			)
		`;

		const createAIUsageTable = `
			CREATE TABLE IF NOT EXISTS ai_usage (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				date TEXT NOT NULL,
				tokens_used INTEGER DEFAULT 0,
				estimated_cost REAL DEFAULT 0,
				requests_count INTEGER DEFAULT 0,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`;

		const createAIUsageDateIndex = `
			CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(date)
		`;

		const createResearchStatementsTable = `
			CREATE TABLE IF NOT EXISTS research_statements (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name VARCHAR(100) NOT NULL,
				statement TEXT NOT NULL,
				embedding BLOB,
				keywords TEXT,
				negative_keywords TEXT,
				is_active BOOLEAN DEFAULT 1,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`;

		const createContentFeaturesTable = `
			CREATE TABLE IF NOT EXISTS content_features (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content_item_id INTEGER NOT NULL,
				research_statement_id INTEGER NOT NULL,
				content_embedding BLOB,
				similarity_score REAL,
				keyword_score REAL,
				feedback_score REAL,
				final_score REAL,
				relevance_tier INTEGER,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(content_item_id, research_statement_id),
				FOREIGN KEY (content_item_id) REFERENCES content_items(id),
				FOREIGN KEY (research_statement_id) REFERENCES research_statements(id)
			)
		`;

		const createContentFeaturesScoreIndex = `
			CREATE INDEX IF NOT EXISTS idx_content_features_score
			ON content_features(research_statement_id, final_score DESC)
		`;

		const createUserRatingsTable = `
			CREATE TABLE IF NOT EXISTS user_ratings (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content_item_id INTEGER NOT NULL,
				research_statement_id INTEGER NOT NULL,
				rating INTEGER NOT NULL,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(content_item_id, research_statement_id),
				FOREIGN KEY (content_item_id) REFERENCES content_items(id),
				FOREIGN KEY (research_statement_id) REFERENCES research_statements(id)
			)
		`;

		db.serialize(() => {
			db.run(createContentItemsTable, (err) => {
				if (err) return reject(err);
				db.run(createAIUsageTable, (err2) => {
					if (err2) return reject(err2);
					db.run(createAIUsageDateIndex, (err3) => {
						if (err3) return reject(err3);
						db.run(createUserRatingsTable, (err4) => {
							if (err4) return reject(err4);
							db.run(createResearchStatementsTable, (err5) => {
								if (err5) return reject(err5);
								db.get(
									"SELECT COUNT(*) as count FROM research_statements",
									[],
									(err6, row) => {
										if (err6) return reject(err6);
										const needsSeed = !row || Number(row.count) === 0;
										const seedDefault = (next) => {
											if (!needsSeed) return next();
											const insertDefault = `
											INSERT INTO research_statements (name, statement, keywords, negative_keywords, is_active)
											VALUES (?, ?, ?, ?, 1)
										`;
											db.run(
												insertDefault,
												[
													"AI/LLM Research",
													"Focus on AI/LLM, developer tools, code generation, RAG/embeddings, agent systems, and practical applications improving software development workflows.",
													JSON.stringify([]),
													JSON.stringify([]),
												],
												(seedErr) => {
													if (seedErr) return reject(seedErr);
													next();
												}
											);
										};

										seedDefault(() => {
											db.run(createContentFeaturesTable, (err7) => {
												if (err7) return reject(err7);
												db.run(createContentFeaturesScoreIndex, (err8) => {
													if (err8) return reject(err8);
													return resolve();
												});
											});
										});
									}
								);
							});
						});
					});
				});
			});
		});
	});
}

module.exports = { initializeDatabase };
