import { format } from "date-fns";

export function formatDateTime(isoString) {
	try {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) return String(isoString);
		return format(date, "MMM do");
	} catch {
		return String(isoString);
	}
}
