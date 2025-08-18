export async function fetchItems({ limit, offset, source } = {}) {
	const params = new URLSearchParams();
	if (limit != null) params.set("limit", String(limit));
	if (offset != null) params.set("offset", String(offset));
	if (source) params.set("source", source);

	const url = params.toString()
		? `/api/items?${params.toString()}`
		: "/api/items";
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch items: ${res.status}`);
	}
	return res.json();
}
