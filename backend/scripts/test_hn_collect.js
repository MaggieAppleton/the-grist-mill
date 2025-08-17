const { discoverAndHydrateHN } = require("../collectors/hackernews");

(async () => {
	try {
		const items = await discoverAndHydrateHN();
		console.log(
			`Discovered and hydrated ${items.length} HN items (default config).`
		);
		for (const it of items.slice(0, 5)) {
			console.log({
				id: it.id,
				title: it.firebase?.title,
				url: it.firebase?.url,
				by: it.firebase?.by,
				score: it.firebase?.score,
			});
		}
		process.exit(0);
	} catch (err) {
		console.error("HN collect test failed:", err);
		process.exit(1);
	}
})();
