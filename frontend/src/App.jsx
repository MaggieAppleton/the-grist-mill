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

	return (
		<div style={{ padding: 24 }}>
			<h1>The Grist Mill</h1>
			{loading && <p>Loading…</p>}
			{error && <p style={{ color: "red" }}>Error loading items: {error}</p>}
			{items && (
				<ul className="timeline">
					{items.map((item) => (
						<li key={item.id} className="timeline-item">
							<div className="item-header">
								<span className="source-badge">{item.source_type}</span>
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
					))}
				</ul>
			)}
		</div>
	);
}

function App() {
	return <Dashboard />;
}

export default App;
