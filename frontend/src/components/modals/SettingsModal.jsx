import { useEffect, useState } from "react";
import "./Modal.css";
import "./SettingsModal.css";
import useResearchStatements from "../../hooks/useResearchStatements";

function SettingsModal({ settings, loading, error, saving, onClose, onSave }) {
	const [formData, setFormData] = useState({
		maxItems: 50,
		keywords: "",
	});

	// Research Topics (beta)
	const {
		topics,
		loading: topicsLoading,
		error: topicsError,
		saving: topicsSaving,
		create: createTopic,
		update: updateTopic,
		remove: removeTopic,
	} = useResearchStatements({ autoLoad: true });

	const [newTopic, setNewTopic] = useState({
		name: "",
		statement: "",
		keywords: "",
		negative_keywords: "",
		is_active: true,
	});
	const [topicFormError, setTopicFormError] = useState(null);
	const [editingId, setEditingId] = useState(null);
	const [editDraft, setEditDraft] = useState(null);
	const [showCreate, setShowCreate] = useState(false);

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

	function validateNewTopic(nt) {
		if (!nt.name || nt.name.trim().length === 0) return "Title is required";
		if (!nt.statement || nt.statement.trim().length < 20)
			return "Research statement must be at least 20 characters";
		const list = (s) =>
			s
				.split(",")
				.map((x) => x.trim())
				.filter((x) => x.length > 0);
		const kws = list(nt.keywords);
		const neg = list(nt.negative_keywords);
		if (kws.some((k) => k.length > 64)) return "Keywords must be ≤ 64 chars";
		if (neg.some((k) => k.length > 64))
			return "Negative keywords must be ≤ 64 chars";
		return null;
	}

	async function handleCreateTopic(e) {
		e.preventDefault();
		setTopicFormError(null);
		const msg = validateNewTopic(newTopic);
		if (msg) {
			setTopicFormError(msg);
			return;
		}
		const payload = {
			name: newTopic.name.trim(),
			statement: newTopic.statement.trim(),
			keywords: newTopic.keywords
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0),
			negative_keywords: newTopic.negative_keywords
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0),
			is_active: !!newTopic.is_active,
		};
		const res = await createTopic(payload);
		if (!res.ok) {
			setTopicFormError(res.error?.message || "Failed to create topic");
			return;
		}
		setNewTopic({
			name: "",
			statement: "",
			keywords: "",
			negative_keywords: "",
			is_active: true,
		});
		setShowCreate(false);
	}

	function startEditTopic(t) {
		setEditingId(t.id);
		setEditDraft({
			name: t.name || "",
			statement: t.statement || "",
			keywords: (t.keywords || []).join(", "),
			negative_keywords: (t.negative_keywords || []).join(", "),
			is_active: !!t.is_active,
		});
	}

	function cancelEditTopic() {
		setEditingId(null);
		setEditDraft(null);
	}

	async function saveEditTopic() {
		if (!editingId || !editDraft) return;
		const msg = validateNewTopic(editDraft);
		if (msg) {
			setTopicFormError(msg);
			return;
		}
		const payload = {
			name: editDraft.name.trim(),
			statement: editDraft.statement.trim(),
			keywords: editDraft.keywords
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0),
			negative_keywords: editDraft.negative_keywords
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0),
			is_active: !!editDraft.is_active,
		};
		const res = await updateTopic(editingId, payload);
		if (!res.ok) {
			setTopicFormError(res.error?.message || "Failed to update topic");
			return;
		}
		setEditingId(null);
		setEditDraft(null);
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

							{/* Research Topics (beta) */}
							<div className="form-group research-topics">
								<label>Research Topics (beta)</label>
								{topicsLoading && <p>Loading topics…</p>}
								{topicsError && <p className="error-inline">{topicsError}</p>}
								{Array.isArray(topics) && topics.length > 0 ? (
									<ul className="topic-list">
										{topics.map((t) => (
											<li key={t.id} className="topic-item">
												{editingId === t.id ? (
													<div className="topic-edit">
														<div className="topic-grid">
															<div>
																<label htmlFor={`edit-name-${t.id}`}>
																	Title
																</label>
																<input
																	id={`edit-name-${t.id}`}
																	type="text"
																	value={editDraft?.name || ""}
																	onChange={(e) =>
																		setEditDraft((p) => ({
																			...p,
																			name: e.target.value,
																		}))
																	}
																	disabled={topicsSaving}
																/>
															</div>
															<div>
																<label htmlFor={`edit-active-${t.id}`}>
																	Active
																</label>
																<select
																	id={`edit-active-${t.id}`}
																	value={
																		editDraft?.is_active ? "true" : "false"
																	}
																	onChange={(e) =>
																		setEditDraft((p) => ({
																			...p,
																			is_active: e.target.value === "true",
																		}))
																	}
																	disabled={topicsSaving}
																>
																	<option value="true">Active</option>
																	<option value="false">Inactive</option>
																</select>
															</div>
														</div>
														<div className="form-group">
															<label htmlFor={`edit-statement-${t.id}`}>
																Research Statement
															</label>
															<textarea
																id={`edit-statement-${t.id}`}
																rows="3"
																value={editDraft?.statement || ""}
																onChange={(e) =>
																	setEditDraft((p) => ({
																		...p,
																		statement: e.target.value,
																	}))
																}
																disabled={topicsSaving}
															/>
														</div>
														<div className="form-group">
															<label htmlFor={`edit-kws-${t.id}`}>
																Keywords
															</label>
															<textarea
																id={`edit-kws-${t.id}`}
																rows="2"
																value={editDraft?.keywords || ""}
																onChange={(e) =>
																	setEditDraft((p) => ({
																		...p,
																		keywords: e.target.value,
																	}))
																}
																disabled={topicsSaving}
															/>
														</div>
														<div className="form-group">
															<label htmlFor={`edit-neg-${t.id}`}>
																Negative Keywords
															</label>
															<textarea
																id={`edit-neg-${t.id}`}
																rows="2"
																value={editDraft?.negative_keywords || ""}
																onChange={(e) =>
																	setEditDraft((p) => ({
																		...p,
																		negative_keywords: e.target.value,
																	}))
																}
																disabled={topicsSaving}
															/>
															<small>
																Exclude content containing these terms.
															</small>
														</div>
														<div className="form-actions">
															<button
																type="button"
																className="cancel-button"
																onClick={cancelEditTopic}
																disabled={topicsSaving}
															>
																Cancel
															</button>
															<button
																type="button"
																className="save-button"
																onClick={saveEditTopic}
																disabled={topicsSaving}
															>
																Save
															</button>
														</div>
													</div>
												) : (
													<>
														<div className="topic-main">
															<strong className="topic-name">{t.name}</strong>
															<span
																className="topic-active-badge"
																aria-label={t.is_active ? "active" : "inactive"}
															>
																{t.is_active ? "Active" : "Inactive"}
															</span>
														</div>
														<div className="topic-meta">
															<small>
																Keywords:{" "}
																{(t.keywords || []).join(", ") || "(none)"}
															</small>
														</div>
														<div className="topic-actions">
															<button
																type="button"
																className="settings-button"
																disabled={topicsSaving}
																onClick={() =>
																	updateTopic(t.id, { is_active: !t.is_active })
																}
															>
																{t.is_active ? "Deactivate" : "Activate"}
															</button>
															<button
																type="button"
																className="settings-button"
																disabled={topicsSaving}
																onClick={() => startEditTopic(t)}
															>
																Edit
															</button>
															<button
																type="button"
																className="settings-button"
																disabled={topicsSaving}
																onClick={() => {
																	const ok = window.confirm(
																		"Delete this topic? This cannot be undone."
																	);
																	if (ok) removeTopic(t.id);
																}}
															>
																Delete
															</button>
														</div>
													</>
												)}
											</li>
										))}
									</ul>
								) : (
									<p className="empty-inline">
										No topics yet. Create your first topic below.
									</p>
								)}

								{!showCreate ? (
									<div className="form-actions">
										<button
											type="button"
											className="save-button"
											onClick={() => setShowCreate(true)}
											disabled={topicsSaving}
										>
											Create New Research Topic
										</button>
									</div>
								) : (
									<form className="topic-form" onSubmit={handleCreateTopic}>
										<div className="topic-grid">
											<div>
												<label htmlFor="topic-name">Title</label>
												<input
													id="topic-name"
													type="text"
													value={newTopic.name}
													onChange={(e) =>
														setNewTopic((p) => ({ ...p, name: e.target.value }))
													}
													disabled={topicsSaving}
													placeholder="AI/LLM Research"
												/>
											</div>
											<div>
												<label htmlFor="topic-active">Active</label>
												<select
													id="topic-active"
													value={newTopic.is_active ? "true" : "false"}
													onChange={(e) =>
														setNewTopic((p) => ({
															...p,
															is_active: e.target.value === "true",
														}))
													}
													disabled={topicsSaving}
												>
													<option value="true">Active</option>
													<option value="false">Inactive</option>
												</select>
											</div>
										</div>
										<div className="form-group">
											<label htmlFor="topic-statement">
												Research Statement
											</label>
											<textarea
												id="topic-statement"
												rows="4"
												value={newTopic.statement}
												onChange={(e) =>
													setNewTopic((p) => ({
														...p,
														statement: e.target.value,
													}))
												}
												disabled={topicsSaving}
												placeholder="What are you researching?"
											/>
											<small>Used to compute embeddings for relevance.</small>
										</div>
										<div className="form-group">
											<label htmlFor="topic-keywords">
												Keywords (comma-separated)
											</label>
											<textarea
												id="topic-keywords"
												rows="2"
												value={newTopic.keywords}
												onChange={(e) =>
													setNewTopic((p) => ({
														...p,
														keywords: e.target.value,
													}))
												}
												disabled={topicsSaving}
												placeholder="ai, llm, agents, embeddings, ..."
											/>
										</div>
										<div className="form-group">
											<label htmlFor="topic-neg-keywords">
												Negative Keywords (optional)
											</label>
											<textarea
												id="topic-neg-keywords"
												rows="2"
												value={newTopic.negative_keywords}
												onChange={(e) =>
													setNewTopic((p) => ({
														...p,
														negative_keywords: e.target.value,
													}))
												}
												disabled={topicsSaving}
												placeholder="crypto, nft, ..."
											/>
											<small>Exclude content containing these terms.</small>
										</div>
										{topicFormError && (
											<p className="error-inline">{topicFormError}</p>
										)}
										<div className="form-actions">
											<button
												type="button"
												className="cancel-button"
												onClick={() => {
													setShowCreate(false);
													setNewTopic({
														name: "",
														statement: "",
														keywords: "",
														negative_keywords: "",
														is_active: true,
													});
													setTopicFormError(null);
												}}
												disabled={topicsSaving}
											>
												Cancel
											</button>
											<button
												type="submit"
												className="save-button"
												disabled={topicsSaving}
											>
												{topicsSaving ? "Creating…" : "Create Topic"}
											</button>
										</div>
									</form>
								)}
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
