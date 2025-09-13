import { useEffect, useRef } from "react";
import * as d3 from "d3";
import "./UsageChart.css";

function UsageChart({ data, width = 1000, height = 500 }) {
	const svgRef = useRef();
	const tooltipRef = useRef();

	useEffect(() => {
		if (!data || data.length === 0) return;

		// Helper function to format dates as "Sep 2", "Aug 13", etc.
		const formatDate = (dateStr) => {
			const date = new Date(dateStr);
			const months = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			return `${months[date.getMonth()]} ${date.getDate()}`;
		};

		// Clear previous chart
		d3.select(svgRef.current).selectAll("*").remove();

		// Set up dimensions and margins - increased bottom margin for rotated labels
		const margin = { top: 20, right: 40, bottom: 70, left: 80 };
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		// Create SVG
		const svg = d3
			.select(svgRef.current)
			.attr("width", width)
			.attr("height", height);

		const g = svg
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		// Process data - sort by date (newest first, reverse for chart)
		const sortedData = [...data].sort(
			(a, b) => new Date(a.date) - new Date(b.date)
		);

		// Set up scales
		const xScale = d3
			.scaleBand()
			.domain(sortedData.map((d) => d.date))
			.range([0, innerWidth])
			.padding(0.1);

		// Calculate dynamic Y scale based on data
		const maxValue = d3.max(sortedData, (d) => Number(d.estimated_cost));
		const yAxisMax = maxValue === 0 ? 0.001 : maxValue * 1.2; // Add 20% headroom, minimum 0.001

		const yScale = d3
			.scaleLinear()
			.domain([0, yAxisMax])
			.nice()
			.range([innerHeight, 0]);

		// Create tooltip
		const tooltip = d3.select(tooltipRef.current);

		// Create bars
		g.selectAll(".bar")
			.data(sortedData)
			.enter()
			.append("rect")
			.attr("class", "bar")
			.attr("x", (d) => xScale(d.date))
			.attr("width", xScale.bandwidth())
			.attr("y", (d) => {
				const cost = Number(d.estimated_cost);
				return cost === 0 ? innerHeight - 2 : yScale(cost); // Minimum 2px height for zero values
			})
			.attr("height", (d) => {
				const cost = Number(d.estimated_cost);
				return cost === 0 ? 2 : innerHeight - yScale(cost); // Minimum 2px height for zero values
			})
			.attr("fill", (d) => {
				const cost = Number(d.estimated_cost);
				if (cost === 0) return "#e9ecef"; // Light gray for zero values
				return cost >= d.daily_budget_usd ? "#ff6b6b" : "#4ecdc4";
			})
			.on("mouseover", function (event, d) {
				// Highlight bar
				const cost = Number(d.estimated_cost);
				let hoverColor;
				if (cost === 0)
					hoverColor = "#ced4da"; // Slightly darker gray for zero values
				else if (cost >= d.daily_budget_usd) hoverColor = "#ff5252";
				else hoverColor = "#26c6da";
				d3.select(this).attr("fill", hoverColor);

				// Show tooltip - position relative to the chart container
				const chartContainer = svgRef.current.getBoundingClientRect();
				const mouseX = event.clientX - chartContainer.left;
				const mouseY = event.clientY - chartContainer.top;

				tooltip.transition().duration(200).style("opacity", 0.9);
				tooltip.html(
					`
					<div class="tooltip-content">
						<div style="font-weight: 600; margin-bottom: 6px; color: #1a1a1a;">${formatDate(
							d.date
						)}</div>
						<div><span style="color: #4ecdc4;">●</span> Cost: <strong>$${Number(
							d.estimated_cost
						).toFixed(6)}</strong></div>
						<div><span style="color: #6c757d;">●</span> Tokens: <strong>${Number(
							d.tokens_used
						).toLocaleString()}</strong></div>
						<div><span style="color: #ffc107;">●</span> Requests: <strong>${
							d.requests_count
						}</strong></div>
					</div>
				`
				);

				// Smart positioning to prevent cutoff
				const containerRect =
					svgRef.current.parentElement.getBoundingClientRect();
				const tooltipWidth = 180; // Approximate tooltip width
				const tooltipHeight = 90; // Approximate tooltip height

				let tooltipX = mouseX + 10;
				let tooltipY = mouseY - 10;

				// Check if tooltip extends beyond right edge, if so show on left
				if (tooltipX + tooltipWidth > width) {
					tooltipX = mouseX - tooltipWidth - 10;
				}

				// Check if tooltip extends beyond bottom edge
				if (tooltipY + tooltipHeight > height) {
					tooltipY = mouseY - tooltipHeight - 10;
				}

				// Ensure tooltip doesn't go off left edge
				if (tooltipX < 10) {
					tooltipX = 10;
				}

				// Ensure tooltip doesn't go off top edge
				if (tooltipY < 10) {
					tooltipY = mouseY + 20; // Show below cursor instead
				}

				tooltip.style("left", tooltipX + "px").style("top", tooltipY + "px");
			})
			.on("mouseout", function (event, d) {
				// Reset bar color
				const cost = Number(d.estimated_cost);
				let originalColor;
				if (cost === 0) originalColor = "#e9ecef";
				else if (cost >= d.daily_budget_usd) originalColor = "#ff6b6b";
				else originalColor = "#4ecdc4";
				d3.select(this).attr("fill", originalColor);

				// Hide tooltip
				tooltip.transition().duration(500).style("opacity", 0);
			});

		// Add axes with better label handling
		const xAxis = g
			.append("g")
			.attr("class", "x-axis")
			.attr("transform", `translate(0,${innerHeight})`)
			.call(d3.axisBottom(xScale));

		// Format x-axis labels to prevent overlapping
		xAxis
			.selectAll("text")
			.style("text-anchor", "end")
			.style("font-size", "11px")
			.attr("dx", "-.8em")
			.attr("dy", ".15em")
			.attr("transform", "rotate(-45)")
			.text((d) => {
				// Show every other label if there are too many data points to prevent overlap
				const index = sortedData.findIndex((item) => item.date === d);
				if (sortedData.length > 10 && index % 2 !== 0) {
					return "";
				}
				// Format date as "Sep 2", "Aug 13", etc.
				return formatDate(d);
			});

		g.append("g")
			.attr("class", "y-axis")
			.call(
				d3
					.axisLeft(yScale)
					.tickFormat((d) => (d === 0 ? "$0.000" : `$${d.toFixed(3)}`))
					.ticks(5)
			)
			.selectAll("text")
			.style("font-size", "11px");

		// Add axis labels with consistent font sizes
		g.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0 - margin.left + 20)
			.attr("x", 0 - innerHeight / 2)
			.attr("dy", "1em")
			.style("text-anchor", "middle")
			.style("font-size", "12px")
			.style("font-weight", "600")
			.style("fill", "#495057")
			.text("Daily Cost (USD)");

		g.append("text")
			.attr(
				"transform",
				`translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`
			)
			.style("text-anchor", "middle")
			.style("font-size", "12px")
			.style("font-weight", "600")
			.style("fill", "#495057")
			.text("Date");

		// Add budget line
		const budgetLine = g
			.append("line")
			.attr("class", "budget-line")
			.attr("x1", 0)
			.attr("x2", innerWidth)
			.attr("y1", yScale(sortedData[0]?.daily_budget_usd || 1))
			.attr("y2", yScale(sortedData[0]?.daily_budget_usd || 1))
			.attr("stroke", "#ff9800")
			.attr("stroke-width", 2)
			.attr("stroke-dasharray", "5,5");

		// Budget line label with consistent font size
		g.append("text")
			.attr("x", innerWidth - 5)
			.attr("y", yScale(sortedData[0]?.daily_budget_usd || 1) - 5)
			.attr("text-anchor", "end")
			.style("font-size", "11px")
			.style("font-weight", "500")
			.style("fill", "#ff9800")
			.text(`Budget: $${(sortedData[0]?.daily_budget_usd || 1).toFixed(2)}`);
	}, [data, width, height]);

	return (
		<div className="usage-chart-container">
			<svg ref={svgRef}></svg>
			<div ref={tooltipRef} className="chart-tooltip"></div>
		</div>
	);
}

export default UsageChart;
