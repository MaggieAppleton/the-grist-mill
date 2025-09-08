import TimelineItem from "./TimelineItem";

export default function Timeline({ items }) {
	if (!Array.isArray(items)) return null;
	return (
		<ul className="timeline">
			{items.map((item) => (
				<TimelineItem key={item.id} item={item} />
			))}
		</ul>
	);
}


