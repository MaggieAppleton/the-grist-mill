import "./App.css";
import { useEffect, useState } from "react";
import { fetchItems, fetchUsage, triggerHNCollection } from "./services/api";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

function Dashboard() {
	const [items, setItems] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [showUsage, setShowUsage] = useState(false);
	const [usage, setUsage] = useState(null);
	const [usageLoading, setUsageLoading] = useState(false);
	const [usageError, setUsageError] = useState(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	function formatDateTime(isoString) {
		try {
			const date = new Date(isoString);
			if (Number.isNaN(date.getTime())) return String(isoString);
			return format(date, "MMMM do, yyyy 'at' h:mma");
		} catch {
			return String(isoString);
		}
	}

	function getRelevanceScore(item) {
		try {
			if (!item || !item.raw_content) return null;
			const raw =
				typeof item.raw_content === "string"
					? JSON.parse(item.raw_content)
					: item.raw_content;
			const score = raw?.ai_processing?.relevance_score;
			return typeof score === "number" ? score : null;
		} catch {
			return null;
		}
	}

	function getRelevanceExplanation(item) {
		try {
			if (!item || !item.raw_content) return null;
			const raw =
				typeof item.raw_content === "string"
					? JSON.parse(item.raw_content)
					: item.raw_content;
			const exp = raw?.ai_processing?.relevance_explanation;
			return typeof exp === "string" && exp.trim().length > 0 ? exp : null;
		} catch {
			return null;
		}
	}

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

	async function handleRefresh() {
		setIsRefreshing(true);
		setError(null);
		try {
			// Trigger collection (returns immediately)
			await triggerHNCollection();

			// Wait a moment for collection to process, then refresh items
			setTimeout(async () => {
				try {
					const data = await fetchItems({ limit: 20 });
					setItems(data);
				} catch (fetchError) {
					setError(
						`Failed to refresh items: ${
							fetchError.message || String(fetchError)
						}`
					);
				} finally {
					setIsRefreshing(false);
				}
			}, 5000); // Wait 5 seconds for collection to process
		} catch (err) {
			setError(`Manual refresh failed: ${err.message || String(err)}`);
			setIsRefreshing(false);
		}
	}

	const sortedItems = Array.isArray(items)
		? [...items].sort((a, b) => {
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
		<div style={{ padding: 24 }}>
			<div className="header-controls">
				<h1>The Grist Mill</h1>
				<div className="button-group">
					<button
						className="refresh-button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						title="Manually refresh stories"
					>
						{isRefreshing ? "Refreshing..." : "Refresh Stories"}
					</button>
					<button
						className="usage-button"
						title="View AI usage"
						onClick={openUsageModal}
						aria-label="View AI usage"
					>
						$
					</button>
				</div>
			</div>
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
				<ul className="timeline">
					{sortedItems.map((item) => {
						const relevance = getRelevanceScore(item);
						const explanation = getRelevanceExplanation(item);
						const groupTitle = item.highlight
							? explanation || undefined
							: undefined;
						return (
							<li
								key={item.id}
								className={`timeline-item${item.highlight ? " highlight" : ""}`}
							>
								<div className="item-header">
									<span className="source-badge">{item.source_type}</span>
									<span className="badge-group" title={groupTitle}>
										{typeof relevance === "number" && (
											<span className="relevance-chip">{relevance}/10</span>
										)}
										{item.highlight && (
											<span className="highlight-badge" aria-hidden>
												★
											</span>
										)}
									</span>
									<span className="item-time">
										{formatDateTime(item.created_at)}
									</span>
								</div>
								{item.title && (
									<a
										className="item-title"
										href={item.url || undefined}
										target={item.url ? "_blank" : undefined}
										rel={item.url ? "noreferrer" : undefined}
									>
										{item.title}
									</a>
								)}
								{item.summary && (
									<div className="item-summary">
										<ReactMarkdown
											remarkPlugins={[remarkGfm]}
											rehypePlugins={[rehypeSanitize]}
											components={{
												a: ({ ...props }) => (
													<a
														{...props}
														target="_blank"
														rel="noopener noreferrer"
													/>
												),
												p: ({ ...props }) => <p {...props} />,
											}}
										>
											{item.summary}
										</ReactMarkdown>
									</div>
								)}
							</li>
						);
					})}
				</ul>
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
				<div className="modal-backdrop" role="dialog" aria-modal="true">
					<div className="modal">
						<div className="modal-header">
							<h2>AI Usage</h2>
							<button
								className="modal-close"
								onClick={closeUsageModal}
								aria-label="Close"
							>
								×
							</button>
						</div>
						<div className="modal-body">
							{usageLoading && <p>Loading usage…</p>}
							{usageError && (
								<p style={{ color: "red" }}>
									Error loading usage: {usageError}
								</p>
							)}
							{!usageLoading && !usageError && usage && (
								<div>
									<table className="usage-table">
										<thead>
											<tr>
												<th>Date</th>
												<th>Tokens</th>
												<th>Estimated Cost (USD)</th>
												<th>Requests</th>
												<th>Daily Budget</th>
												<th>Remaining</th>
												<th>Exceeded</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>{usage.date}</td>
												<td>{usage.tokens_used}</td>
												<td>{Number(usage.estimated_cost || 0).toFixed(6)}</td>
												<td>{usage.requests_count}</td>
												<td>
													{Number(usage.daily_budget_usd || 0).toFixed(2)}
												</td>
												<td>
													{Number(usage.remaining_budget_usd || 0).toFixed(6)}
												</td>
												<td>{usage.exceeded ? "Yes" : "No"}</td>
											</tr>
										</tbody>
									</table>
									<p className="usage-note">
										Cost per 1K tokens: $
										{Number(usage.cost_per_1k_tokens_usd || 0).toFixed(5)}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function App() {
	return <Dashboard />;
}

export default App;
