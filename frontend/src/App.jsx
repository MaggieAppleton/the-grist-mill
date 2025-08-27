import "./App.css";
import { useEffect, useState } from "react";
import { fetchItems } from "./services/api";
import { format } from "date-fns";

function Dashboard() {
	const [items, setItems] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

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
			<h1>The Grist Mill</h1>
			{loading && <p>Loading…</p>}
			{error && <p style={{ color: "red" }}>Error loading items: {error}</p>}
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
								{item.summary && <p className="item-summary">{item.summary}</p>}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function App() {
	return <Dashboard />;
}

export default App;
