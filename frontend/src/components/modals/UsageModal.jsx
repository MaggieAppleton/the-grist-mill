import "./Modal.css";
import "./UsageModal.css";
import UsageChart from "./UsageChart";

function UsageModal({ usage, loading, error, onClose }) {
	return (
		<div className="modal-backdrop" role="dialog" aria-modal="true">
			<div className="modal usage-modal">
				<div className="modal-header">
					<h2>AI Usage</h2>
					<button className="modal-close" onClick={onClose} aria-label="Close">
						×
					</button>
				</div>
				<div className="modal-body">
					{loading && <p>Loading usage…</p>}
					{error && (
						<p style={{ color: "red" }}>Error loading usage: {error}</p>
					)}
					{!loading && !error && usage && (
						<div>
							{/* Cumulative Cost Callout */}
							<div className="cumulative-cost-box">
								<h3>Total Cost</h3>
								<div className="cost-amount">
									${Number(usage.cumulative_cost || 0).toFixed(6)}
								</div>
								<div className="cost-details">
									Daily Budget: $
									{Number(usage.daily_budget_usd || 0).toFixed(2)} | Cost per 1K
									tokens: $
									{Number(usage.cost_per_1k_tokens_usd || 0).toFixed(5)}
								</div>
							</div>

							{/* Chart */}
							{usage.historical_data && usage.historical_data.length > 0 && (
								<div className="chart-container">
									<UsageChart
										data={usage.historical_data}
										width={1000}
										height={500}
									/>
								</div>
							)}

							{(!usage.historical_data ||
								usage.historical_data.length === 0) && (
								<p className="no-data-message">No usage data available.</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default UsageModal;
