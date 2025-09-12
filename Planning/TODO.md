# Human Todo List

- [] Make sure Max HN items is only defined in one place. Currently in both the collector and the local .env file.
- [] Check where we're defining the keywords that we use to filter HN items for. Currently some in the local .env file. Should be somewhere better. Are these stored in the database?
- [] Review how highlighting system works – how are these items processed once they're scored high
- [] Quality check which HN items are being ranked as highly relevant. Review the prompt that it's evaluating them with
- [] How are we handling fetching new items and saving them to the database? Are we keeping old items? Where in the interface can we see historical / old items? Need to add the concept of time to the dashboard.

- [] Refreshing results is slow / doesn't show up in the interface
- [] Cost modal isn't showing accumulating cost over time. Seems to refresh every day?

- [] Empty state on dashboard
- [] Fix top menu bar layout collapse
- [] Script to seed database with 3+days of HN items after DB reset