import { useState, useMemo, useEffect, useRef } from "react";
import TimelineItem from "./TimelineItem";
import "./Timeline.css";
import { formatDateTime } from "../../utils/dates";

export default function Timeline({ items, activeResearchStatementId }) {
	const [currentDayOffset, setCurrentDayOffset] = useState(0);
	const [activeItemId, setActiveItemId] = useState(null);
	const [columnsPerView, setColumnsPerView] = useState(3);
	const daysRef = useRef(null);

	const MIN_COL_WIDTH = 350; // px

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

	// Determine visible window based on columnsPerView
	const visibleDays = dayGroups.slice(
		currentDayOffset,
		currentDayOffset + columnsPerView
	);

	// Navigation handlers
	const canGoBack = currentDayOffset > 0;
	const canGoForward = currentDayOffset + columnsPerView < dayGroups.length;

	const goBack = () => {
		if (canGoBack) setCurrentDayOffset(currentDayOffset - 1);
	};

	const goForward = () => {
		if (canGoForward) setCurrentDayOffset(currentDayOffset + 1);
	};

	// Update columnsPerView responsively based on container width
	useEffect(() => {
		const element = daysRef.current;
		if (!element) return;

		const computeColumnsPerView = () => {
			const width = element.clientWidth;
			const styles = getComputedStyle(element);
			const gapValue = styles.gap || styles.columnGap || "0px";
			const gap = parseFloat(gapValue) || 0;

			// Compute how many 350px columns fit given the current gap
			const maxColumns = 3;
			const columns = Math.floor((width + gap - 0.5) / (MIN_COL_WIDTH + gap));
			return Math.max(1, Math.min(maxColumns, columns));
		};

		const handleMeasure = () => {
			const next = computeColumnsPerView();
			setColumnsPerView((prev) => (prev !== next ? next : prev));
		};

		const ro = new ResizeObserver(handleMeasure);
		ro.observe(element);

		// Also listen to window resize for robustness
		window.addEventListener("resize", handleMeasure);

		// Initial measurement
		handleMeasure();

		return () => {
			ro.disconnect();
			window.removeEventListener("resize", handleMeasure);
		};
		// Re-run when day groups mount/change so the ref exists and size may differ
	}, [dayGroups.length]);

	// Keep offset within bounds when columnsPerView or dayGroups change
	useEffect(() => {
		if (dayGroups.length === 0) return;
		const maxStart = Math.max(0, dayGroups.length - columnsPerView);
		if (currentDayOffset > maxStart) {
			setCurrentDayOffset(maxStart);
		}
	}, [columnsPerView, dayGroups.length]);

	return (
		<div className="timeline-container">
			<div className="timeline-days" ref={daysRef}>
				{visibleDays.map((dayGroup) => (
					<div key={dayGroup.date} className="timeline-day-column">
						<div className="timeline-day-header">
							<div className="timeline-day-date">
								{formatDateTime(dayGroup.date)}
							</div>
						</div>
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

			{dayGroups.length > columnsPerView && (
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
