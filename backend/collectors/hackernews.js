/*
 * Hacker News Collector
 * - Discover stories from last 24h via Algolia HN Search (keyword-based)
 * - Hydrate canonical item data via official Firebase API
 */

const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(
	__dirname,
	"..",
	"config",
	"user-settings.json"
);

// Fallback defaults (same as env vars)
const FALLBACK_MAX_ITEMS = Number(process.env.HN_MAX_ITEMS || 50);
const FALLBACK_QUERY = (
	process.env.HN_QUERY ||
	"ai,llm,language model,gpt,openai,anthropic,claude,llama,transformer,rag,embedding,fine-tuning,copilot,cursor,code generation,agents"
)
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

const FALLBACK_MIN_POINTS = Number(process.env.HN_MIN_POINTS || 0);

// Read settings from JSON file with fallbacks
function getSettings() {
	try {
		const data = fs.readFileSync(SETTINGS_FILE, "utf8");
		const settings = JSON.parse(data);
		return {
			maxItems: settings.hackernews?.maxItems || FALLBACK_MAX_ITEMS,
			keywords: settings.hackernews?.keywords || FALLBACK_QUERY,
			minPoints: settings.hackernews?.minPoints ?? FALLBACK_MIN_POINTS,
		};
	} catch (error) {
		console.log(`[HN Collector] Using fallback settings: ${error.message}`);
		return {
			maxItems: FALLBACK_MAX_ITEMS,
			keywords: FALLBACK_QUERY,
			minPoints: FALLBACK_MIN_POINTS,
		};
	}
}

function getUnixNowSeconds() {
	return Math.floor(Date.now() / 1000);
}

function getUnix24hAgoSeconds() {
	return getUnixNowSeconds() - 24 * 60 * 60;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discoverStories({
	keywords,
	maxItems,
	since = getUnix24hAgoSeconds(),
	pageDelayMs = 150,
} = {}) {
	// Get current settings if not provided
	if (!keywords || !maxItems) {
		const settings = getSettings();
		keywords = keywords || settings.keywords;
		maxItems = maxItems || settings.maxItems;
	}
	const collected = [];
	const seen = new Set();
	const hitsPerPage = Math.min(50, Math.max(10, Math.floor(maxItems / 2)));

	for (const raw of keywords) {
		if (collected.length >= maxItems) break;
		const term = raw.includes(" ") ? `"${raw}"` : raw;
		let page = 0;
		for (;;) {
			if (collected.length >= maxItems) break;
			const u = new URL("https://hn.algolia.com/api/v1/search_by_date");
			const params = new URLSearchParams();
			params.set("query", term);
			params.set("tags", "story");
			params.set("numericFilters", `created_at_i>=${since}`);
			params.set("page", String(page));
			params.set("hitsPerPage", String(hitsPerPage));
			u.search = params.toString();
			const res = await fetch(u);
			if (!res.ok) {
				throw new Error(
					`Algolia request failed: ${res.status} ${res.statusText}`
				);
			}
			const data = await res.json();
			const hits = Array.isArray(data.hits) ? data.hits : [];
			for (const hit of hits) {
				if (collected.length >= maxItems) break;
				const idNum = Number(hit.objectID);
				if (!seen.has(idNum)) {
					seen.add(idNum);
					collected.push({ id: idNum, hit });
				}
			}
			if (page >= (data.nbPages || 0) - 1) break;
			page += 1;
			if (pageDelayMs > 0) await sleep(pageDelayMs);
		}
	}

	return collected;
}

async function hydrateFirebaseItems(items, { perRequestDelayMs = 100 } = {}) {
	const results = [];
	for (const item of items) {
		try {
			const url = `https://hacker-news.firebaseio.com/v0/item/${item.id}.json`;
			const res = await fetch(url);
			if (!res.ok) {
				throw new Error(
					`Firebase request failed: ${res.status} ${res.statusText}`
				);
			}
			const json = await res.json();
			results.push({ id: item.id, firebase: json, algolia: item.hit });
			if (perRequestDelayMs > 0) await sleep(perRequestDelayMs);
		} catch (error) {
			console.log(`Failed to hydrate item ${item.id}: ${error.message}`);
		}
	}
	return results;
}

async function discoverAndHydrateHN(options = {}) {
	// Try Algolia discovery first
	let discovered = [];
	try {
		discovered = await discoverStories(options);
	} catch (err) {
		console.log(
			`Algolia discovery failed: ${err.message}. Falling back to Firebase newstories.`
		);
	}
	if (discovered.length === 0) {
		discovered = await discoverViaFirebase(options);
	}
	const hydrated = await hydrateFirebaseItems(discovered);

	// Optional score threshold filtering
	const minPoints = Number.isFinite(options.minPoints)
		? Number(options.minPoints)
		: getSettings().minPoints;
	if (Number.isFinite(minPoints) && minPoints > 0) {
		return hydrated.filter((it) => Number(it?.firebase?.score) >= minPoints);
	}
	return hydrated;
}

async function discoverViaFirebase({
	keywords,
	maxItems,
	since = getUnix24hAgoSeconds(),
	perRequestDelayMs = 50,
} = {}) {
	// Get current settings if not provided
	if (!keywords || !maxItems) {
		const settings = getSettings();
		keywords = keywords || settings.keywords;
		maxItems = maxItems || settings.maxItems;
	}
	const idsRes = await fetch(
		"https://hacker-news.firebaseio.com/v0/newstories.json"
	);
	if (!idsRes.ok) {
		throw new Error(
			`Firebase newstories failed: ${idsRes.status} ${idsRes.statusText}`
		);
	}
	const ids = await idsRes.json();
	const collected = [];
	for (const id of ids) {
		if (collected.length >= maxItems) break;
		try {
			const itemRes = await fetch(
				`https://hacker-news.firebaseio.com/v0/item/${id}.json`
			);
			if (!itemRes.ok) continue;
			const item = await itemRes.json();
			if (!item || item.type !== "story") continue;
			if (typeof item.time !== "number" || item.time < since) {
				// We reached items older than 24h; continue scanning a bit more to be safe
				continue;
			}
			const hay = `${item.title || ""} ${item.url || ""}`.toLowerCase();
			const match = keywords.some((k) => hay.includes(k.toLowerCase()));
			if (match) {
				collected.push({
					id: Number(item.id),
					hit: { title: item.title, url: item.url },
				});
			}
			if (perRequestDelayMs > 0) await sleep(perRequestDelayMs);
		} catch (_) {}
	}
	return collected;
}

async function discoverTopStoriesViaFirebase({
	maxItems,
	perRequestDelayMs = 50,
} = {}) {
	// Get current settings if not provided
	if (!maxItems) {
		const settings = getSettings();
		maxItems = settings.maxItems;
	}

	const idsRes = await fetch(
		"https://hacker-news.firebaseio.com/v0/topstories.json"
	);
	if (!idsRes.ok) {
		throw new Error(
			`Firebase topstories failed: ${idsRes.status} ${idsRes.statusText}`
		);
	}
	const ids = await idsRes.json();
	const collected = [];
	for (const id of ids) {
		if (collected.length >= maxItems) break;
		try {
			const itemRes = await fetch(
				`https://hacker-news.firebaseio.com/v0/item/${id}.json`
			);
			if (!itemRes.ok) continue;
			const item = await itemRes.json();
			if (!item || item.type !== "story") continue;
			collected.push({
				id: Number(item.id),
				hit: { title: item.title, url: item.url },
			});
			if (perRequestDelayMs > 0) await sleep(perRequestDelayMs);
		} catch (_) {}
	}
	return collected;
}

async function discoverTopAndRecentWithMinScore(options = {}) {
	const settings = getSettings();
	const mergedOptions = {
		maxItems: options.maxItems || settings.maxItems,
		keywords: options.keywords || settings.keywords,
		minPoints: Number.isFinite(options.minPoints)
			? options.minPoints
			: settings.minPoints,
	};

	// Fetch top stories and recent keyword stories
	const [top, recent] = await Promise.all([
		discoverTopStoriesViaFirebase({ maxItems: mergedOptions.maxItems }),
		(async () => {
			try {
				return await discoverStories(mergedOptions);
			} catch (_) {
				return await discoverViaFirebase(mergedOptions);
			}
		})(),
	]);

	// Merge by id
	const byId = new Map();
	for (const it of [...top, ...recent]) {
		if (!byId.has(it.id)) byId.set(it.id, it);
	}

	// Hydrate and apply score threshold
	const hydrated = await hydrateFirebaseItems(Array.from(byId.values()));
	const minPoints = Number(mergedOptions.minPoints) || 0;
	const filtered =
		minPoints > 0
			? hydrated.filter((it) => Number(it?.firebase?.score) >= minPoints)
			: hydrated;

	// Truncate to maxItems
	return filtered.slice(0, mergedOptions.maxItems);
}

module.exports = {
	discoverStories,
	hydrateFirebaseItems,
	discoverAndHydrateHN,
	discoverViaFirebase,
	discoverTopStoriesViaFirebase,
	discoverTopAndRecentWithMinScore,
};
