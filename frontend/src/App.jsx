import "./App.css";
import { useEffect, useState } from "react";
import { fetchItems } from "./services/api";

function Dashboard() {
	const [items, setItems] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

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
				<pre
					style={{
						background: "#0b1021",
						color: "#d6deeb",
						padding: 16,
						borderRadius: 8,
						overflowX: "auto",
					}}
				>
					{JSON.stringify(items, null, 2)}
				</pre>
			)}
		</div>
	);
}

function App() {
	return <Dashboard />;
}

export default App;
