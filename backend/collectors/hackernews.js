/*
 * Hacker News Collector
 * - Discover stories from last 24h via Algolia HN Search (keyword-based)
 * - Hydrate canonical item data via official Firebase API
 */

const DEFAULT_MAX_ITEMS = Number(process.env.HN_MAX_ITEMS || 50);
const DEFAULT_QUERY = (
	process.env.HN_QUERY ||
	"ai,llm,language model,gpt,openai,anthropic,claude,llama,transformer,rag,embedding,fine-tuning,copilot,cursor,code generation,agents"
)
	.split(",")
	.map((s) => s.trim())
	.filter(Boolean);

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
	keywords = DEFAULT_QUERY,
	maxItems = DEFAULT_MAX_ITEMS,
	since = getUnix24hAgoSeconds(),
	pageDelayMs = 150,
} = {}) {
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
	return hydrated;
}

async function discoverViaFirebase({
	keywords = DEFAULT_QUERY,
	maxItems = DEFAULT_MAX_ITEMS,
	since = getUnix24hAgoSeconds(),
	perRequestDelayMs = 50,
} = {}) {
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

module.exports = {
	discoverStories,
	hydrateFirebaseItems,
	discoverAndHydrateHN,
	discoverViaFirebase,
};
