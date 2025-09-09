import ReactMarkdown from "react-markdown";
import { formatDateTime } from "../../utils/dates";
import { getRelevanceScore, extractDomain } from "../../utils/items";
import { markdownPlugins, markdownComponents } from "../../utils/markdown";
import "./TimelineItem.css";

export default function TimelineItem({ item }) {
	const relevance = getRelevanceScore(item);
	const isHighRelevance = item.highlight || (typeof relevance === "number" && relevance >= 7);
	const domain = extractDomain(item.url);
	
	const getSourceBadgeClass = (sourceType) => {
		if (!sourceType) return "default";
		const type = sourceType.toLowerCase();
		if (type === "hackernews" || type === "hn") return "hn";
		if (type === "bluesky" || type === "bs") return "bs";
		return "default";
	};

	return (
		<li className="timeline-item">
			<div className={`timeline-item-card ${isHighRelevance ? "high-relevance" : "low-relevance"}`}>
				{item.source_type && (
					<span className={`source-badge ${getSourceBadgeClass(item.source_type)}`}>
						{item.source_type === "hackernews" ? "HN" : item.source_type === "bluesky" ? "BS" : item.source_type.toUpperCase()}
					</span>
				)}
				
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
				
				{domain && (
					<div className="item-url">{domain}</div>
				)}
				
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


