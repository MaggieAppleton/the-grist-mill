import { useCallback, useState } from "react";
import { searchItems } from "../services/api";

export default function useSearch({ defaultLimit = 50 } = {}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const clear = useCallback(() => {
		setQuery("");
		setResults(null);
		setError(null);
	}, []);

	const run = useCallback(async (rawQuery) => {
		const nextQuery = (rawQuery || "").trim();
		if (nextQuery.length === 0) {
			clear();
			return;
		}
		setLoading(true);
		setError(null);
		setQuery(nextQuery);
		try {
			const data = await searchItems({ query: nextQuery, limit: defaultLimit });
			setResults(data);
		} catch (err) {
			setError(err.message || String(err));
			setResults(null);
		} finally {
			setLoading(false);
		}
	}, [clear, defaultLimit]);

	return { query, results, loading, error, run, clear };
}


