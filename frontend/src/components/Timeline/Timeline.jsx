import { useState, useMemo } from "react";
import TimelineItem from "./TimelineItem";
import "./Timeline.css";

export default function Timeline({ items, activeResearchStatementId }) {
	const [currentDayOffset, setCurrentDayOffset] = useState(0);
	const [activeItemId, setActiveItemId] = useState(null);

	// Group items by day
	const dayGroups = useMemo(() => {
		if (!Array.isArray(items)) return [];
		const groups = {};

		items.forEach((item) => {
			const date = new Date(item.created_at);
			const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

			if (!groups[dayKey]) {
				groups[dayKey] = {
					date: dayKey,
					items: [],
				};
			}
			groups[dayKey].items.push(item);
		});

		// Sort days by most recent first
		return Object.values(groups).sort(
			(a, b) => new Date(b.date) - new Date(a.date)
		);
	}, [items]);

	if (dayGroups.length === 0) return null;

	// Get current 3-day window
	const visibleDays = dayGroups.slice(currentDayOffset, currentDayOffset + 3);

	// Navigation handlers
	const canGoBack = currentDayOffset > 0;
	const canGoForward = currentDayOffset + 3 < dayGroups.length;

	const goBack = () => {
		if (canGoBack) setCurrentDayOffset(currentDayOffset - 1);
	};

	const goForward = () => {
		if (canGoForward) setCurrentDayOffset(currentDayOffset + 1);
	};

	return (
		<div className="timeline-container">
			<div className="timeline-days">
				{visibleDays.map((dayGroup) => (
					<div key={dayGroup.date} className="timeline-day-column">
						<div className="timeline-day-items">
							<ul className="timeline">
								{dayGroup.items.map((item) => (
									<TimelineItem
										key={item.id}
										item={item}
										activeResearchStatementId={activeResearchStatementId}
										isActive={activeItemId === item.id}
										onActivate={() => setActiveItemId(item.id)}
									/>
								))}
							</ul>
						</div>
					</div>
				))}
			</div>

			{dayGroups.length > 3 && (
				<>
					<button
						className={`nav-button nav-back ${!canGoBack ? "disabled" : ""}`}
						onClick={goBack}
						disabled={!canGoBack}
						aria-label="View newer days"
					>
						‹
					</button>
					<button
						className={`nav-button nav-forward ${
							!canGoForward ? "disabled" : ""
						}`}
						onClick={goForward}
						disabled={!canGoForward}
						aria-label="View older days"
					>
						›
					</button>
				</>
			)}
		</div>
	);
}
