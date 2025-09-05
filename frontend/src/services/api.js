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

export async function fetchUsage() {
	const res = await fetch("/api/usage");
	if (!res.ok) {
		throw new Error(`Failed to fetch usage: ${res.status}`);
	}
	return res.json();
}

export async function triggerHNCollection() {
	const res = await fetch("/api/collectors/hackernews", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
	});
	if (!res.ok) {
		throw new Error(`Failed to trigger HN collection: ${res.status}`);
	}
	return res.json();
}

export async function fetchSettings() {
	const res = await fetch("/api/settings");
	if (!res.ok) {
		throw new Error(`Failed to fetch settings: ${res.status}`);
	}
	return res.json();
}

export async function updateSettings(settings) {
	const res = await fetch("/api/settings", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(settings),
	});
	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`Failed to update settings: ${res.status} ${errorText}`);
	}
	return res.json();
}
