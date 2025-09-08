import "./App.css";
import { useState } from "react";
import {
	fetchUsage,
	fetchSettings,
	updateSettings,
} from "./services/api";
import SettingsModal from "./components/modals/SettingsModal";
import UsageModal from "./components/modals/UsageModal";
import { getRelevanceScore } from "./utils/items";
import HeaderBar from "./components/HeaderBar/HeaderBar";
import Timeline from "./components/Timeline/Timeline";
import useFeed from "./hooks/useFeed";
import useSearch from "./hooks/useSearch";

function Dashboard() {
	const { items, loading, error, isRefreshing, retry, refresh } = useFeed({
		initialLimit: 20,
	});
	const { query: searchQuery, results: searchResults, loading: isSearching, error: searchError, run: runSearch, clear: clearSearch } = useSearch({ defaultLimit: 50 });
	const [showUsage, setShowUsage] = useState(false);
	const [usage, setUsage] = useState(null);
	const [usageLoading, setUsageLoading] = useState(false);
	const [usageError, setUsageError] = useState(null);
	const [showSettings, setShowSettings] = useState(false);
	const [settings, setSettings] = useState(null);
	const [settingsLoading, setSettingsLoading] = useState(false);
	const [settingsError, setSettingsError] = useState(null);
	const [settingsSaving, setSettingsSaving] = useState(false);

	async function retryFetchItems() {
		await retry();
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
		await refresh();
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
				onSearch={runSearch}
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
