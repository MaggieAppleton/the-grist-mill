const { db } = require("./connection");

function getAiUsageForDate(dateStr) {
	return new Promise((resolve, reject) => {
		const query = `
		      SELECT tokens_used, estimated_cost, requests_count
		      FROM ai_usage
		      WHERE date = ?
		    `;
		db.get(query, [dateStr], (err, row) => {
			if (err) {
				console.error("Error fetching ai_usage for date:", err.message);
				return reject(err);
			}
			if (!row) {
				return resolve({
					tokens_used: 0,
					estimated_cost: 0,
					requests_count: 0,
				});
			}
			resolve(row);
		});
	});
}

function getTodayAiUsage() {
	const today = new Date().toISOString().slice(0, 10);
	return getAiUsageForDate(today);
}

function getHistoricalAiUsage(days = 14) {
	return new Promise((resolve, reject) => {
		const query = `
		      SELECT date, tokens_used, estimated_cost, requests_count
		      FROM ai_usage
		      WHERE date >= date('now', '-' || ? || ' days')
		      ORDER BY date DESC
		    `;
		db.all(query, [days], (err, rows) => {
			if (err) {
				console.error("Error fetching historical ai_usage:", err.message);
				return reject(err);
			}
			
			// Generate a complete array of the last N days with zeros for missing days
			const result = [];
			const today = new Date();
			
			for (let i = 0; i < days; i++) {
				const date = new Date(today);
				date.setDate(today.getDate() - i);
				const dateStr = date.toISOString().slice(0, 10);
				
				const existingRecord = (rows || []).find(row => row.date === dateStr);
				
				result.push({
					date: dateStr,
					tokens_used: existingRecord ? existingRecord.tokens_used : 0,
					estimated_cost: existingRecord ? existingRecord.estimated_cost : 0,
					requests_count: existingRecord ? existingRecord.requests_count : 0,
				});
			}
			
			// Sort by date (oldest first for chart)
			result.sort((a, b) => new Date(a.date) - new Date(b.date));
			
			resolve(result);
		});
	});
}

function incrementAiUsage({
	tokensUsed = 0,
	estimatedCost = 0,
	requestsCount = 1,
} = {}) {
	return new Promise((resolve, reject) => {
		const today = new Date().toISOString().slice(0, 10);
		const upsert = `
		      INSERT INTO ai_usage (date, tokens_used, estimated_cost, requests_count)
		      VALUES (?, ?, ?, ?)
		      ON CONFLICT(date) DO UPDATE SET
		        tokens_used = tokens_used + excluded.tokens_used,
		        estimated_cost = estimated_cost + excluded.estimated_cost,
		        requests_count = requests_count + excluded.requests_count
		    `;
		db.run(
			upsert,
			[
				today,
				Math.max(0, Math.floor(tokensUsed)),
				Math.max(0, Number(estimatedCost) || 0),
				Math.max(0, Math.floor(requestsCount)),
			],
			function (err) {
				if (err) {
					console.error("Error incrementing ai_usage:", err.message);
					return reject(err);
				}
				resolve(this.changes);
			}
		);
	});
}

module.exports = {
	getAiUsageForDate,
	getTodayAiUsage,
	getHistoricalAiUsage,
	incrementAiUsage,
};
