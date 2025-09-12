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

export async function searchItems({ query, source, limit, offset } = {}) {
	const params = new URLSearchParams();
	if (!query || query.trim().length === 0) {
		throw new Error("Search query is required");
	}
	params.set("q", query.trim());
	if (source) params.set("source", source);
	if (limit != null) params.set("limit", String(limit));
	if (offset != null) params.set("offset", String(offset));

	const url = `/api/search?${params.toString()}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to search items: ${res.status}`);
	}
	return res.json();
}

// Research Statements API

export async function fetchResearchStatements() {
	const res = await fetch("/api/research-statements");
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(
			`Failed to fetch research statements: ${res.status}`
		);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}

export async function createResearchStatement(payload) {
	const res = await fetch("/api/research-statements", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(
			`Failed to create research statement: ${res.status}`
		);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}

export async function updateResearchStatement(id, payload) {
	const res = await fetch(`/api/research-statements/${id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(
			`Failed to update research statement: ${res.status}`
		);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}

export async function deleteResearchStatement(id) {
	const res = await fetch(`/api/research-statements/${id}`, {
		method: "DELETE",
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(
			`Failed to delete research statement: ${res.status}`
		);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return { ok: true };
}

export async function regenerateResearchStatementEmbedding(id) {
	const res = await fetch(
		`/api/research-statements/${id}/regenerate-embedding`,
		{
			method: "POST",
		}
	);
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(`Failed to regenerate embedding: ${res.status}`);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}

// Feedback / Ratings API
export async function rateItem({
	content_item_id,
	research_statement_id,
	rating,
}) {
	const res = await fetch("/api/feedback/rate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ content_item_id, research_statement_id, rating }),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(`Failed to rate item: ${res.status}`);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}

// Favorites API
export async function toggleFavorite({
	content_item_id,
	is_favorite,
	research_statement_id,
}) {
	const res = await fetch("/api/favorites/toggle", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			content_item_id,
			is_favorite,
			research_statement_id,
		}),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		const error = new Error(`Failed to toggle favorite: ${res.status}`);
		error.status = res.status;
		error.body = text;
		throw error;
	}
	return res.json();
}
