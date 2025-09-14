const cron = require("node-cron");
const { runHackerNewsCollection } = require("./hn-collection");
const { runRerank } = require("./rerank");

function initializeScheduler() {
	// Daily job - runs at 6:00 AM every day
	cron.schedule("0 6 * * *", async () => {
		console.log(
			`[${new Date().toISOString()}] Daily HN collection job triggered`
		);
		try {
			const result = await runHackerNewsCollection();
			if (result.success) {
				console.log(
					`[${new Date().toISOString()}] Daily HN collection completed successfully`
				);
			} else {
				console.error(
					`[${new Date().toISOString()}] Daily HN collection failed: ${
						result.error
					}`
				);
			}
		} catch (error) {
			console.error(
				`[${new Date().toISOString()}] Daily HN collection error:`,
				error
			);
		}
	});

	// Optional nightly rerank job (disabled by default)
	const enableNightlyRerank =
		String(process.env.ENABLE_NIGHTLY_RERANK || "false") === "true";
	const rerankCron = process.env.RERANK_CRON || "30 6 * * *"; // default: 6:30 AM daily
	const rerankBatchSize = Number(process.env.RERANK_BATCH_SIZE || 100);
	if (enableNightlyRerank) {
		cron.schedule(rerankCron, async () => {
			console.log(
				`[${new Date().toISOString()}] Nightly rerank job triggered (cron="${rerankCron}")`
			);
			try {
				const result = await runRerank({
					force: true,
					batchSize: rerankBatchSize,
				});
				if (result.ok) {
					console.log(
						`[${new Date().toISOString()}] Nightly rerank started successfully`
					);
				} else {
					console.warn(
						`[${new Date().toISOString()}] Nightly rerank skipped/failed to start: ${
							result.error
						}`
					);
				}
			} catch (error) {
				console.error(
					`[${new Date().toISOString()}] Nightly rerank error:`,
					error
				);
			}
		});
	}

	console.log(
		`[${new Date().toISOString()}] Scheduler initialized - HN collection job will run daily at 6:00 AM`
	);
	if (enableNightlyRerank) {
		console.log(
			`[${new Date().toISOString()}] Scheduler: Nightly rerank enabled (cron="${rerankCron}")`
		);
	} else {
		console.log(
			`[${new Date().toISOString()}] Scheduler: Nightly rerank disabled (set ENABLE_NIGHTLY_RERANK=true to enable)`
		);
	}
}

module.exports = { initializeScheduler };
