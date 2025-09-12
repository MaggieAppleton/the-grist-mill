import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { formatDateTime } from "../../utils/dates";
import { getRelevanceScore, extractDomain } from "../../utils/items";
import { markdownPlugins, markdownComponents } from "../../utils/markdown";
import { rateItem, toggleFavorite } from "../../services/api";
import "./TimelineItem.css";

export default function TimelineItem({
	item,
	activeResearchStatementId,
	isActive = false,
	onActivate,
}) {
	const relevance = getRelevanceScore(item);
	const isHighRelevance =
		item.highlight || (typeof relevance === "number" && relevance >= 7);
	const domain = extractDomain(item.url);
	const [isFavorite, setIsFavorite] = useState(!!item.is_favorite);
	const [ratingTier, setRatingTier] = useState(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef(null);

	const getSourceBadgeClass = (sourceType) => {
		if (!sourceType) return "default";
		const type = sourceType.toLowerCase();
		if (type === "hackernews" || type === "hn") return "hn";
		if (type === "bluesky" || type === "bs") return "bs";
		return "default";
	};

	const tierToLabel = useMemo(
		() => ({
			1: "Not Relevant",
			2: "Weakly Relevant",
			3: "Relevant",
			4: "Very Relevant",
		}),
		[]
	);

	const handleRate = useCallback(
		async (tier) => {
			if (!activeResearchStatementId) return;
			setRatingTier(tier);
			try {
				await rateItem({
					content_item_id: item.id,
					research_statement_id: activeResearchStatementId,
					rating: tier,
				});
			} catch {
				// Revert on error
				setRatingTier((prev) => prev);
			}
		},
		[activeResearchStatementId, item?.id]
	);

	const handleToggleFavorite = useCallback(async () => {
		const next = !isFavorite;
		setIsFavorite(next);
		try {
			await toggleFavorite({
				content_item_id: item.id,
				is_favorite: next,
				research_statement_id: activeResearchStatementId,
			});
			if (next && activeResearchStatementId) {
				setRatingTier(4);
			}
		} catch {
			setIsFavorite(!next);
		}
	}, [isFavorite, item?.id, activeResearchStatementId]);

	// Keyboard shortcuts: only when this item is active
	useEffect(() => {
		if (!isActive) return;
		function onKeyDown(e) {
			if (
				e.target &&
				(e.target.tagName === "INPUT" ||
					e.target.tagName === "TEXTAREA" ||
					e.target.isContentEditable)
			)
				return;
			if (e.key >= "1" && e.key <= "4") {
				const tier = Number(e.key);
				handleRate(tier);
			}
			if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				handleToggleFavorite();
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isActive, handleRate, handleToggleFavorite]);

	// Close menu on outside click
	useEffect(() => {
		function onDocClick(e) {
			if (!menuOpen) return;
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				setMenuOpen(false);
			}
		}
		document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	}, [menuOpen]);

	return (
		<li className="timeline-item">
			<div
				onMouseEnter={onActivate}
				onClick={onActivate}
				className={`timeline-item-card ${
					isHighRelevance ? "high-relevance" : "low-relevance"
				} ${isActive ? "active" : ""}`}
				tabIndex={0}
				onFocus={onActivate}
			>
				{item.source_type && (
					<span
						className={`source-badge ${getSourceBadgeClass(item.source_type)}`}
					>
						{item.source_type === "hackernews"
							? "HN"
							: item.source_type === "bluesky"
							? "BS"
							: item.source_type.toUpperCase()}
					</span>
				)}

				{/* Relevance + Favorite controls */}
				<div className="item-controls" ref={menuRef}>
					<button
						className={`relevance-dot tier-${ratingTier || 0}`}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen(!menuOpen)}
						title={ratingTier ? tierToLabel[ratingTier] : "Rate relevance"}
					/>
					<button
						className={`favorite-button ${isFavorite ? "active" : ""}`}
						aria-pressed={isFavorite}
						onClick={handleToggleFavorite}
						title={isFavorite ? "Unfavorite" : "Favorite"}
					>
						{isFavorite ? "♥" : "♡"}
					</button>

					{menuOpen && (
						<div className="relevance-menu" role="menu">
							{[4, 3, 2, 1].map((tier) => (
								<button
									key={tier}
									className={`relevance-option tier-${tier}`}
									role="menuitemradio"
									aria-checked={ratingTier === tier}
									onClick={() => {
										setMenuOpen(false);
										handleRate(tier);
									}}
								>
									<span className={`dot tier-${tier}`} aria-hidden />{" "}
									{tierToLabel[tier]}
								</button>
							))}
						</div>
					)}
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

				{domain && <div className="item-url">{domain}</div>}

				<div className="item-date">{formatDateTime(item.created_at)}</div>

				{isHighRelevance && item.summary && (
					<div className="item-description">
						<ReactMarkdown
							remarkPlugins={markdownPlugins.remarkPlugins}
							rehypePlugins={markdownPlugins.rehypePlugins}
							components={markdownComponents}
						>
							{item.summary}
						</ReactMarkdown>
					</div>
				)}
			</div>
		</li>
	);
}
