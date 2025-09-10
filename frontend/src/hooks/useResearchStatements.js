import { useCallback, useEffect, useRef, useState } from "react";
import {
	fetchResearchStatements,
	createResearchStatement,
	updateResearchStatement,
	deleteResearchStatement,
	regenerateResearchStatementEmbedding,
} from "../services/api";

export default function useResearchStatements({ autoLoad = false } = {}) {
	const [topics, setTopics] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);
	const isMountedRef = useRef(true);

	function parseRow(row) {
		if (!row || typeof row !== "object") return row;
		const clone = { ...row };
		try {
			if (typeof clone.keywords === "string") {
				clone.keywords = JSON.parse(clone.keywords || "[]");
			}
		} catch (_) {
			clone.keywords = [];
		}
		try {
			if (typeof clone.negative_keywords === "string") {
				clone.negative_keywords = JSON.parse(clone.negative_keywords || "[]");
			}
		} catch (_) {
			clone.negative_keywords = [];
		}
		if (typeof clone.is_active !== "boolean") {
			clone.is_active = !!clone.is_active;
		}
		return clone;
	}

	useEffect(() => {
		isMountedRef.current = true;
		if (autoLoad) void load();
		return () => {
			isMountedRef.current = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoLoad]);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const list = await fetchResearchStatements();
			if (!isMountedRef.current) return;
			const normalized = Array.isArray(list) ? list.map(parseRow) : [];
			setTopics(normalized);
		} catch (err) {
			if (!isMountedRef.current) return;
			// Handle backend-not-ready (404/501) gracefully
			const status = err?.status;
			if (status === 404 || status === 501) {
				setTopics([]);
				setError(null);
			} else {
				setError(err.message || String(err));
			}
		} finally {
			if (!isMountedRef.current) return;
			setLoading(false);
		}
	}, []);

	const create = useCallback(async (topic) => {
		setSaving(true);
		setError(null);
		try {
			const created = await createResearchStatement(topic);
			const norm = parseRow(created);
			setTopics((prev) => [norm, ...(Array.isArray(prev) ? prev : [])]);
			return { ok: true, data: created };
		} catch (err) {
			setError(err.message || String(err));
			return { ok: false, error: err };
		} finally {
			setSaving(false);
		}
	}, []);

	const update = useCallback(async (id, updates) => {
		setSaving(true);
		setError(null);
		try {
			const updated = await updateResearchStatement(id, updates);
			const norm = parseRow(updated);
			setTopics((prev) =>
				(prev || []).map((t) => (t.id === id ? { ...t, ...norm } : t))
			);
			return { ok: true, data: updated };
		} catch (err) {
			setError(err.message || String(err));
			return { ok: false, error: err };
		} finally {
			setSaving(false);
		}
	}, []);

	const remove = useCallback(async (id) => {
		setSaving(true);
		setError(null);
		try {
			await deleteResearchStatement(id);
			setTopics((prev) => (prev || []).filter((t) => t.id !== id));
			return { ok: true };
		} catch (err) {
			setError(err.message || String(err));
			return { ok: false, error: err };
		} finally {
			setSaving(false);
		}
	}, []);

	const regenerateEmbedding = useCallback(async (id) => {
		setSaving(true);
		setError(null);
		try {
			const res = await regenerateResearchStatementEmbedding(id);
			return { ok: true, data: res };
		} catch (err) {
			setError(err.message || String(err));
			return { ok: false, error: err };
		} finally {
			setSaving(false);
		}
	}, []);

	return {
		topics,
		loading,
		error,
		saving,
		load,
		create,
		update,
		remove,
		regenerateEmbedding,
	};
}
