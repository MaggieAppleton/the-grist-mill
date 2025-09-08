import { useCallback, useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "../services/api";

export default function useSettings() {
	const [settings, setSettings] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchSettings();
			setSettings(data);
		} catch (err) {
			setError(err.message || String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		// lazy; consumer can call load on demand
	}, []);

	const save = useCallback(async (newSettings) => {
		setSaving(true);
		setError(null);
		try {
			await updateSettings(newSettings);
			setSettings(newSettings);
			return { ok: true };
		} catch (err) {
			setError(err.message || String(err));
			return { ok: false, error: err };
		} finally {
			setSaving(false);
		}
	}, []);

	return { settings, loading, error, saving, load, save };
}
