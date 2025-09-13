import "./App.css";
import { useState } from "react";
import { fetchUsage } from "./services/api";
import SettingsModal from "./components/modals/SettingsModal";
import UsageModal from "./components/modals/UsageModal";
import { getRelevanceScore } from "./utils/items";
import HeaderBar from "./components/HeaderBar/HeaderBar";
import Timeline from "./components/Timeline/Timeline";
import useFeed from "./hooks/useFeed";
import useSearch from "./hooks/useSearch";
import useSettings from "./hooks/useSettings";
import useResearchStatements from "./hooks/useResearchStatements";

function Dashboard() {
	// Load research statements and pick active one (fallback to first)
	const { topics } = useResearchStatements({ autoLoad: true });
	const activeResearchStatementId = Array.isArray(topics)
		? (topics.find((t) => t.is_active) || topics[0])?.id
		: undefined;

	const { items, loading, error, isRefreshing, retry, refresh } = useFeed({
		initialLimit: 200,
		researchStatementId: activeResearchStatementId,
	});
	const {
		query: searchQuery,
		results: searchResults,
		loading: isSearching,
		error: searchError,
		run: runSearch,
		clear: clearSearch,
	} = useSearch({ defaultLimit: 200 });
	const [showUsage, setShowUsage] = useState(false);
	const [usage, setUsage] = useState(null);
	const [usageLoading, setUsageLoading] = useState(false);
	const [usageError, setUsageError] = useState(null);
	const [showSettings, setShowSettings] = useState(false);
	const {
		settings,
		loading: settingsLoading,
		error: settingsError,
		saving: settingsSaving,
		load: loadSettings,
		save: saveSettings,
	} = useSettings();

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
		await loadSettings();
	}

	function closeSettingsModal() {
		setShowSettings(false);
	}

	async function handleSettingsSave(newSettings) {
		// Close immediately for snappy UX; persist in background
		closeSettingsModal();
		try {
			await saveSettings(newSettings);
		} catch (e) {
			// Optional: surface a toast/error later; for now, log quietly
			console.error("Failed to save settings", e);
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
			{sortedItems && (
				<Timeline
					items={sortedItems}
					activeResearchStatementId={activeResearchStatementId}
				/>
			)}

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
