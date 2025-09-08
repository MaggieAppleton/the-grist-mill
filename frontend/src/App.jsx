import "./App.css";
import { useEffect, useState } from "react";
import {
	fetchItems,
	fetchUsage,
	triggerHNCollection,
	fetchSettings,
	updateSettings,
	searchItems,
} from "./services/api";
import SettingsModal from "./components/modals/SettingsModal";
import UsageModal from "./components/modals/UsageModal";
import { getRelevanceScore } from "./utils/items";
import HeaderBar from "./components/HeaderBar/HeaderBar";
import Timeline from "./components/Timeline/Timeline";

function Dashboard() {
	const [items, setItems] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [showUsage, setShowUsage] = useState(false);
	const [usage, setUsage] = useState(null);
	const [usageLoading, setUsageLoading] = useState(false);
	const [usageError, setUsageError] = useState(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [settings, setSettings] = useState(null);
	const [settingsLoading, setSettingsLoading] = useState(false);
	const [settingsError, setSettingsError] = useState(null);
	const [settingsSaving, setSettingsSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState(null);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState(null);

	useEffect(() => {
		let isMounted = true;
		setLoading(true);
		fetchItems({ limit: 20 })
			.then((data) => {
				if (!isMounted) return;
				setItems(data);
			})
			.catch((err) => {
				if (!isMounted) return;
				setError(err.message || String(err));
			})
			.finally(() => {
				if (!isMounted) return;
				setLoading(false);
			});
		return () => {
			isMounted = false;
		};
	}, []);

	async function retryFetchItems() {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchItems({ limit: 20 });
			setItems(data);
		} catch (err) {
			setError(err.message || String(err));
		} finally {
			setLoading(false);
		}
	}

	async function openUsageModal() {
		setShowUsage(true);
		setUsageError(null);
		setUsageLoading(true);
		try {
			const data = await fetchUsage();
			setUsage(data);
		} catch (err) {
			setUsageError(err.message || String(err));
		} finally {
			setUsageLoading(false);
		}
	}

	function closeUsageModal() {
		setShowUsage(false);
	}

	async function openSettingsModal() {
		setShowSettings(true);
		setSettingsError(null);
		setSettingsLoading(true);
		try {
			const data = await fetchSettings();
			setSettings(data);
		} catch (err) {
			setSettingsError(err.message || String(err));
		} finally {
			setSettingsLoading(false);
		}
	}

	function closeSettingsModal() {
		setShowSettings(false);
	}

	async function handleSettingsSave(newSettings) {
		setSettingsSaving(true);
		setSettingsError(null);
		try {
			await updateSettings(newSettings);
			setSettings(newSettings);
			// Show success feedback
			setTimeout(() => {
				closeSettingsModal();
			}, 1000);
		} catch (err) {
			setSettingsError(err.message || String(err));
		} finally {
			setSettingsSaving(false);
		}
	}

	async function handleRefresh() {
		setIsRefreshing(true);
		setError(null);
		try {
			// Trigger collection (returns immediately)
			await triggerHNCollection();

			// Poll for updated items for up to ~60s
			const POLL_INTERVAL_MS = 3000;
			const MAX_WAIT_MS = 60000;
			const start = Date.now();
			const deadline = start + MAX_WAIT_MS;
			let lastCount = Array.isArray(items) ? items.length : 0;

			while (Date.now() < deadline) {
				try {
					const data = await fetchItems({ limit: 20 });
					setItems(data);
					const countNow = Array.isArray(data) ? data.length : 0;
					// If we see more items than we had, stop early
					if (countNow > lastCount) break;
				} catch (fetchError) {
					// Surface error but continue polling until timeout
					setError(
						`Failed to refresh items: ${
							fetchError.message || String(fetchError)
						}`
					);
				}

				await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
			}
		} catch (err) {
			setError(`Manual refresh failed: ${err.message || String(err)}`);
		} finally {
			setIsRefreshing(false);
		}
	}

	async function handleSearch(query) {
		if (!query || query.trim().length === 0) {
			// Clear search results and show regular items
			setSearchResults(null);
			setSearchError(null);
			setSearchQuery("");
			return;
		}

		setIsSearching(true);
		setSearchError(null);
		setSearchQuery(query);

		try {
			const data = await searchItems({ query: query.trim(), limit: 50 });
			setSearchResults(data);
		} catch (err) {
			setSearchError(err.message || String(err));
			setSearchResults(null);
		} finally {
			setIsSearching(false);
		}
	}

	function clearSearch() {
		setSearchQuery("");
		setSearchResults(null);
		setSearchError(null);
	}

	// Use search results if available, otherwise regular items
	const displayItems = searchResults ? searchResults.results : items;

	const sortedItems = Array.isArray(displayItems)
		? [...displayItems].sort((a, b) => {
				const aScore = getRelevanceScore(a);
				const bScore = getRelevanceScore(b);
				const normA = typeof aScore === "number" ? aScore : -1;
				const normB = typeof bScore === "number" ? bScore : -1;
				if (normA !== normB) return normB - normA; // relevance desc
				const aTime = new Date(a.created_at).getTime() || 0;
				const bTime = new Date(b.created_at).getTime() || 0;
				return bTime - aTime; // date desc
		  })
		: null;

	return (
		<div className="container">
			<HeaderBar
				onSearch={handleSearch}
				onClear={clearSearch}
				isSearching={isSearching}
				currentQuery={searchQuery}
				isRefreshing={isRefreshing}
				onRefresh={handleRefresh}
				onOpenUsage={openUsageModal}
				onOpenSettings={openSettingsModal}
				searchResults={searchResults}
				searchError={searchError}
			/>

			{/* Removed dashboard-level refreshing message; indicator now inline in header */}

			{loading && (
				<p className="loading-line">
					<span className="spinner" aria-hidden /> Loading…
				</p>
			)}
			{error && (
				<div className="error-alert" role="alert">
					<div className="error-message">Error loading items: {error}</div>
					<div className="error-actions">
						<button
							className="retry-button"
							onClick={retryFetchItems}
							disabled={loading}
						>
							Try Again
						</button>
					</div>
				</div>
			)}
			{sortedItems && <Timeline items={sortedItems} />}

			{!loading && !error && Array.isArray(items) && items.length === 0 && (
				<div className="empty-state">
					<div className="empty-icon" aria-hidden>
						📰
					</div>
					<h2 className="empty-title">No stories yet</h2>
					<p className="empty-subtitle">
						Fetch the latest Hacker News stories to get started.
					</p>
					<div className="empty-actions">
						<button
							className="refresh-button"
							onClick={handleRefresh}
							disabled={isRefreshing}
						>
							{isRefreshing ? "Fetching…" : "Fetch Latest"}
						</button>
					</div>
				</div>
			)}

			{showUsage && (
				<UsageModal
					usage={usage}
					loading={usageLoading}
					error={usageError}
					onClose={closeUsageModal}
				/>
			)}

			{showSettings && (
				<SettingsModal
					settings={settings}
					loading={settingsLoading}
					error={settingsError}
					saving={settingsSaving}
					onClose={closeSettingsModal}
					onSave={handleSettingsSave}
				/>
			)}
		</div>
	);
}

function App() {
	return <Dashboard />;
}

export default App;
