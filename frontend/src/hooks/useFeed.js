import { useCallback, useEffect, useRef, useState } from "react";
import { fetchItems, triggerHNCollection } from "../services/api";

export default function useFeed({
	initialLimit = 20,
	pollIntervalMs = 3000,
	maxWaitMs = 60000,
	researchStatementId,
} = {}) {
	const [items, setItems] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		setLoading(true);
		fetchItems({
			limit: initialLimit,
			research_statement_id: researchStatementId,
			sort: researchStatementId ? "score_desc" : undefined,
		})
			.then((data) => {
				if (!isMountedRef.current) return;
				setItems(data);
			})
			.catch((err) => {
				if (!isMountedRef.current) return;
				setError(err.message || String(err));
			})
			.finally(() => {
				if (!isMountedRef.current) return;
				setLoading(false);
			});
		return () => {
			isMountedRef.current = false;
		};
	}, [initialLimit, researchStatementId]);

	const retry = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchItems({
				limit: initialLimit,
				research_statement_id: researchStatementId,
				sort: researchStatementId ? "score_desc" : undefined,
			});
			setItems(data);
		} catch (err) {
			setError(err.message || String(err));
		} finally {
			setLoading(false);
		}
	}, [initialLimit, researchStatementId]);

	const refresh = useCallback(async () => {
		setIsRefreshing(true);
		setError(null);
		try {
			await triggerHNCollection();
			const deadline = Date.now() + maxWaitMs;
			let lastCount = Array.isArray(items) ? items.length : 0;
			while (Date.now() < deadline) {
				try {
					const data = await fetchItems({
						limit: initialLimit,
						research_statement_id: researchStatementId,
						sort: researchStatementId ? "score_desc" : undefined,
					});
					setItems(data);
					const countNow = Array.isArray(data) ? data.length : 0;
					if (countNow > lastCount) break;
				} catch (fetchError) {
					setError(
						`Failed to refresh items: ${
							fetchError.message || String(fetchError)
						}`
					);
				}
				await new Promise((r) => setTimeout(r, pollIntervalMs));
			}
		} catch (err) {
			setError(`Manual refresh failed: ${err.message || String(err)}`);
		} finally {
			setIsRefreshing(false);
		}
	}, [initialLimit, items, maxWaitMs, pollIntervalMs, researchStatementId]);

	return { items, setItems, loading, error, isRefreshing, retry, refresh };
}
