#!/usr/bin/env node
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
	initializeDatabase,
	insertContentItems,
	closeDatabase,
} = require("../database");
const { discoverAndHydrateHN } = require("../collectors/hackernews");

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
			created_at:
				typeof f.time === "number"
					? new Date(f.time * 1000).toISOString()
					: null,
		};
	});
}

function hoursAgoToUnix(hours) {
	const now = Math.floor(Date.now() / 1000);
	return now - Math.floor(Number(hours) * 3600);
}

async function main() {
	await initializeDatabase();

	const hoursArg = process.argv.find((a) => a && a.startsWith("--hours="));
	const maxArg = process.argv.find((a) => a && a.startsWith("--max="));
	const minPointsArg = process.argv.find(
		(a) => a && a.startsWith("--minPoints=")
	);

	const hours = hoursArg ? Number(hoursArg.split("=")[1]) : 48;
	const maxItems = maxArg
		? Number(maxArg.split("=")[1])
		: Number(process.env.HN_MAX_ITEMS || 80);
	const minPoints = minPointsArg
		? Number(minPointsArg.split("=")[1])
		: Number(process.env.HN_MIN_POINTS || 0);

	const since = hoursAgoToUnix(hours);
	console.log(
		`[Seed] Discovering HN stories since ${hours}h ago (unix ${since}), maxItems=${maxItems}, minPoints=${minPoints}`
	);

	try {
		const hydrated = await discoverAndHydrateHN({ since, maxItems, minPoints });
		console.log(`[Seed] Hydrated ${hydrated.length} stories`);
		const items = mapHydratedToContentItems(hydrated);
		const inserted = await insertContentItems(items);
		console.log(`[Seed] Inserted ${inserted} items into database.`);
	} catch (err) {
		console.error("[Seed] Ingest failed:", err);
		process.exitCode = 1;
	} finally {
		await closeDatabase();
	}
}

main();
