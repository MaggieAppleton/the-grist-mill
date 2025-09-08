import ReactMarkdown from "react-markdown";
import { formatDateTime } from "../../utils/dates";
import { getRelevanceScore, getRelevanceExplanation, getHNCommentsUrl } from "../../utils/items";
import { markdownPlugins, markdownComponents } from "../../utils/markdown";

export default function TimelineItem({ item }) {
	const relevance = getRelevanceScore(item);
	const explanation = getRelevanceExplanation(item);
	const groupTitle = item.highlight ? explanation || undefined : undefined;
	return (
		<li className={`timeline-item${item.highlight ? " highlight" : ""}`}>
			<div className="item-header">
				<span className="source-badge">{item.source_type}</span>
				<span className="badge-group" title={groupTitle}>
					{typeof relevance === "number" && (
						<span className="relevance-chip">{relevance}/10</span>
					)}
					{item.highlight && (
						<span className="highlight-badge" aria-hidden>
							★
						</span>
					)}
				</span>
				<span className="item-time">{formatDateTime(item.created_at)}</span>
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
			{getHNCommentsUrl(item) && (
				<span className="item-links" style={{ marginTop: 6, display: "block" }}>
					<a
						className="comments-link"
						href={getHNCommentsUrl(item)}
						target="_blank"
						rel="noreferrer"
						title="View on Hacker News"
					>
						<span className="hn-badge" aria-label="Hacker News">HN</span>{" "}
						comments
					</a>
				</span>
			)}
			{item.summary && (
				<div className="item-summary">
					<ReactMarkdown
						remarkPlugins={markdownPlugins.remarkPlugins}
						rehypePlugins={markdownPlugins.rehypePlugins}
						components={markdownComponents}
					>
						{item.summary}
					</ReactMarkdown>
				</div>
			)}
		</li>
	);
}


