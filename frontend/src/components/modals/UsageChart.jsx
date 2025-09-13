import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './UsageChart.css';

function UsageChart({ data, width = 800, height = 400 }) {
	const svgRef = useRef();
	const tooltipRef = useRef();

	useEffect(() => {
		if (!data || data.length === 0) return;

		// Clear previous chart
		d3.select(svgRef.current).selectAll("*").remove();
		
		// Set up dimensions and margins
		const margin = { top: 20, right: 30, bottom: 40, left: 60 };
		const innerWidth = width - margin.left - margin.right;
		const innerHeight = height - margin.top - margin.bottom;

		// Create SVG
		const svg = d3.select(svgRef.current)
			.attr("width", width)
			.attr("height", height);

		const g = svg.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		// Process data - sort by date (newest first, reverse for chart)
		const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

		// Set up scales
		const xScale = d3.scaleBand()
			.domain(sortedData.map(d => d.date))
			.range([0, innerWidth])
			.padding(0.1);

		const yScale = d3.scaleLinear()
			.domain([0, d3.max(sortedData, d => Number(d.estimated_cost))])
			.nice()
			.range([innerHeight, 0]);

		// Create tooltip
		const tooltip = d3.select(tooltipRef.current);

		// Create bars
		g.selectAll(".bar")
			.data(sortedData)
			.enter().append("rect")
			.attr("class", "bar")
			.attr("x", d => xScale(d.date))
			.attr("width", xScale.bandwidth())
			.attr("y", d => {
				const cost = Number(d.estimated_cost);
				return cost === 0 ? innerHeight - 2 : yScale(cost);  // Minimum 2px height for zero values
			})
			.attr("height", d => {
				const cost = Number(d.estimated_cost);
				return cost === 0 ? 2 : innerHeight - yScale(cost);  // Minimum 2px height for zero values
			})
			.attr("fill", d => {
				const cost = Number(d.estimated_cost);
				if (cost === 0) return "#e9ecef";  // Light gray for zero values
				return cost >= d.daily_budget_usd ? "#ff6b6b" : "#4ecdc4";
			})
			.on("mouseover", function(event, d) {
				// Highlight bar
				const cost = Number(d.estimated_cost);
				let hoverColor;
				if (cost === 0) hoverColor = "#ced4da";  // Slightly darker gray for zero values
				else if (cost >= d.daily_budget_usd) hoverColor = "#ff5252";
				else hoverColor = "#26c6da";
				d3.select(this).attr("fill", hoverColor);
				
				// Show tooltip
				tooltip.transition()
					.duration(200)
					.style("opacity", .9);
				tooltip.html(`
					<div class="tooltip-content">
						<strong>${d.date}</strong><br/>
						Cost: $${Number(d.estimated_cost).toFixed(6)}<br/>
						Tokens: ${Number(d.tokens_used).toLocaleString()}<br/>
						Requests: ${d.requests_count}
					</div>
				`)
					.style("left", (event.pageX + 10) + "px")
					.style("top", (event.pageY - 28) + "px");
			})
			.on("mouseout", function(event, d) {
				// Reset bar color
				const cost = Number(d.estimated_cost);
				let originalColor;
				if (cost === 0) originalColor = "#e9ecef";
				else if (cost >= d.daily_budget_usd) originalColor = "#ff6b6b";
				else originalColor = "#4ecdc4";
				d3.select(this).attr("fill", originalColor);
				
				// Hide tooltip
				tooltip.transition()
					.duration(500)
					.style("opacity", 0);
			});

		// Add axes
		g.append("g")
			.attr("class", "x-axis")
			.attr("transform", `translate(0,${innerHeight})`)
			.call(d3.axisBottom(xScale))
			.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", ".15em")
			.attr("transform", "rotate(-45)");

		g.append("g")
			.attr("class", "y-axis")
			.call(d3.axisLeft(yScale).tickFormat(d => `$${d.toFixed(3)}`));

		// Add axis labels
		g.append("text")
			.attr("transform", "rotate(-90)")
			.attr("y", 0 - margin.left)
			.attr("x", 0 - (innerHeight / 2))
			.attr("dy", "1em")
			.style("text-anchor", "middle")
			.text("Daily Cost (USD)");

		g.append("text")
			.attr("transform", `translate(${innerWidth / 2}, ${innerHeight + margin.bottom})`)
			.style("text-anchor", "middle")
			.text("Date");

		// Add budget line
		const budgetLine = g.append("line")
			.attr("class", "budget-line")
			.attr("x1", 0)
			.attr("x2", innerWidth)
			.attr("y1", yScale(sortedData[0]?.daily_budget_usd || 1))
			.attr("y2", yScale(sortedData[0]?.daily_budget_usd || 1))
			.attr("stroke", "#ff9800")
			.attr("stroke-width", 2)
			.attr("stroke-dasharray", "5,5");

		// Budget line label
		g.append("text")
			.attr("x", innerWidth - 5)
			.attr("y", yScale(sortedData[0]?.daily_budget_usd || 1) - 5)
			.attr("text-anchor", "end")
			.style("font-size", "12px")
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