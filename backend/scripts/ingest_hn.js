const {
	initializeDatabase,
	insertContentItems,
	closeDatabase,
} = require("../database");
const {
	discoverTopAndRecentWithMinScore,
} = require("../collectors/hackernews");

function mapHydratedToContentItems(hydrated) {
	return hydrated.map((it) => {
		const f = it.firebase || {};
		return {
			source_type: "hackernews",
			source_id: String(it.id),
			title: f.title || null,
			summary: f.title
				? `${f.title} — ${f.score ?? 0} points by ${f.by ?? "unknown"}`
				: null,
			raw_content: JSON.stringify({ firebase: f, algolia: it.algolia || null }),
			url:
				f.url || (f.id ? `https://news.ycombinator.com/item?id=${f.id}` : null),
		};
	});
}

(async () => {
	try {
		await initializeDatabase();
		const hydrated = await discoverTopAndRecentWithMinScore({ minPoints: 20 });
		const items = mapHydratedToContentItems(hydrated);
		const inserted = await insertContentItems(items);
		console.log(`Inserted ${inserted} Hacker News items.`);
	} catch (err) {
		console.error("HN ingest failed:", err);
		process.exitCode = 1;
	} finally {
		await closeDatabase();
	}
})();
