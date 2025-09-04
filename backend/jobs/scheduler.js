const cron = require('node-cron');
const { runHackerNewsCollection } = require('./hn-collection');

function initializeScheduler() {
	// Daily job - runs at 6:00 AM every day
	cron.schedule('0 6 * * *', async () => {
		console.log(`[${new Date().toISOString()}] Daily HN collection job triggered`);
		try {
			const result = await runHackerNewsCollection();
			if (result.success) {
				console.log(`[${new Date().toISOString()}] Daily HN collection completed successfully`);
			} else {
				console.error(`[${new Date().toISOString()}] Daily HN collection failed: ${result.error}`);
			}
		} catch (error) {
			console.error(`[${new Date().toISOString()}] Daily HN collection error:`, error);
		}
	});
	
	console.log(`[${new Date().toISOString()}] Scheduler initialized - HN collection job will run daily at 6:00 AM`);
}

module.exports = { initializeScheduler };