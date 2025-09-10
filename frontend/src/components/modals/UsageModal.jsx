import "./Modal.css";
import "./UsageModal.css";

function UsageModal({ usage, loading, error, onClose }) {
	return (
		<div className="modal-backdrop" role="dialog" aria-modal="true">
			<div className="modal">
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
										<td>{Number(usage.daily_budget_usd || 0).toFixed(2)}</td>
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
	);
}

export default UsageModal;
