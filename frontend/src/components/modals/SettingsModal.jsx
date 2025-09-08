import { useEffect, useState } from "react";

function SettingsModal({ settings, loading, error, saving, onClose, onSave }) {
	const [formData, setFormData] = useState({
		maxItems: 50,
		keywords: "",
	});

	useEffect(() => {
		if (settings?.hackernews) {
			setFormData({
				maxItems: settings.hackernews.maxItems || 50,
				keywords: (settings.hackernews.keywords || []).join(", "),
			});
		}
	}, [settings]);

	function handleSubmit(e) {
		e.preventDefault();
		const keywordArray = formData.keywords
			.split(",")
			.map((k) => k.trim())
			.filter((k) => k.length > 0);

		const newSettings = {
			hackernews: {
				maxItems: parseInt(formData.maxItems, 10),
				keywords: keywordArray,
			},
		};

		onSave(newSettings);
	}

	return (
		<div className="modal-backdrop" role="dialog" aria-modal="true">
			<div className="modal">
				<div className="modal-header">
					<h2>Settings</h2>
					<button className="modal-close" onClick={onClose} aria-label="Close">
						×
					</button>
				</div>
				<div className="modal-body">
					{loading && <p>Loading settings…</p>}
					{error && (
						<p style={{ color: "red" }}>Error loading settings: {error}</p>
					)}
					{!loading && !error && settings && (
						<form onSubmit={handleSubmit}>
							<div className="form-group">
								<label htmlFor="maxItems">Max Items per Collection:</label>
								<input
									id="maxItems"
									type="number"
									min="1"
									max="100"
									value={formData.maxItems}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											maxItems: parseInt(e.target.value, 10) || 1,
										}))
									}
									disabled={saving}
								/>
								<small>Number of stories to collect (1-100)</small>
							</div>
							<div className="form-group">
								<label htmlFor="keywords">Keywords (comma-separated):</label>
								<textarea
									id="keywords"
									rows="4"
									value={formData.keywords}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											keywords: e.target.value,
										}))
									}
									disabled={saving}
									placeholder="ai, llm, machine learning, etc."
								/>
								<small>Stories matching these keywords will be collected</small>
							</div>
							<div className="form-actions">
								<button
									type="button"
									className="cancel-button"
									onClick={onClose}
									disabled={saving}
								>
									Cancel
								</button>
								<button type="submit" className="save-button" disabled={saving}>
									{saving ? "Saving…" : "Save Settings"}
								</button>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}

export default SettingsModal;


