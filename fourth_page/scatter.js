import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

d3.csv("../glucose_summary.csv").then(data => {
  const svg = d3.select("#scatter");
  const width = +svg.attr("width") - 60;
  const height = +svg.attr("height") - 60;
  const margin = { top: 30, right: 30, bottom: 50, left: 60 };

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  data.forEach(d => {
    d.mean_glucose = +d.mean_glucose;
    d.std_glucose = +d.std_glucose;
    d.participant = d.participant || d.Participant || d.ID || d.id;
  });

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.mean_glucose)).nice()
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.std_glucose)).nice()
    .range([height, 0]);

  const genderColor = d3.scaleOrdinal()
    .domain(["MALE", "FEMALE"])
    .range(["#ADD8E6", "pink"]);

  const selectionColor = d3.scaleOrdinal().range(["#7c3aed", "#10b981"]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .append("text")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("fill", "#374151")
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .text("Mean Glucose (mg/dL)");

  g.append("g")
    .call(d3.axisLeft(y))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("fill", "#374151")
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .text("Glucose Std Dev (mg/dL)");

  const selectedIds = new Set(["1", "14"]);
  const tooltip = d3.select("#tooltip");

  const circles = g.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.mean_glucose))
    .attr("cy", d => y(d.std_glucose))
    .attr("r", 6)
    .attr("fill", d => genderColor(d.Gender))
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>Participant:</strong> ${d.participant}<br/>
          <strong>Gender:</strong> ${d.Gender}<br/>
          <strong>Mean Glucose:</strong> ${d.mean_glucose.toFixed(1)} mg/dL<br/>
          <strong>Glucose Std Dev:</strong> ${d.std_glucose.toFixed(1)} mg/dL<br/>
          <strong>HbA1c:</strong> ${d.HbA1c || 'N/A'}
        `);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    })
    .on("click", function (event, d) {
      const pid = d.participant;
      if (!pid || isNaN(+pid)) return;

      if (selectedIds.has(pid)) {
        selectedIds.delete(pid);
      } else if (selectedIds.size < 2) {
        selectedIds.add(pid);
      }
      updateScatterHighlights([...selectedIds]);
      drawGlucoseTrends([...selectedIds]);
    });

  updateScatterHighlights([...selectedIds]);
  drawGlucoseTrends([...selectedIds]);

  function updateScatterHighlights(selected) {
    circles.attr("fill", d => {
      const index = selected.indexOf(d.participant);
      return index >= 0 ? selectionColor(index) : genderColor(d.Gender);
    }).attr("r", d => selected.includes(d.participant) ? 8 : 6)
      .attr("stroke-width", d => selected.includes(d.participant) ? 2 : 0.5);
  }

  function drawGlucoseTrends(ids) {
    const svg = d3.select("#glucose-trend");
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 40, bottom: 60, left: 90 },
          width = +svg.attr("width") - margin.left - margin.right,
          height = +svg.attr("height") - margin.top - margin.bottom,
          g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("clipPath")
      .attr("id", "clip-area")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    const files = ids.map(id => `../data_breakfast/${id}_breakfast.json`);

    Promise.all(files.map(f => d3.json(f))).then(datasets => {
      datasets.forEach(dataset => {
        const baseTime = d3.timeParse("%H:%M:%S")(dataset[0].time);
        dataset.forEach(pt => {
          const current = d3.timeParse("%H:%M:%S")(pt.time);
          pt.minutes_after_meal = (current - baseTime) / 60000;
        });
      });

      const allPoints = datasets.flat();

      const x = d3.scaleLinear()
        .domain([0, d3.max(allPoints, d => d.minutes_after_meal)])
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([d3.min(allPoints, d => d.glucose) - 10, d3.max(allPoints, d => d.glucose) + 10])
        .range([height, 0]);

      g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d => `${d} min`));

      g.append("g")
        .call(d3.axisLeft(y));

      // X-axis label
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#374151")
        .text("Time After Standard Breakfast");

      // Y-axis label
      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#374151")
        .text("Glucose Level (mg/dL)");

      // Orange postprandial threshold line
      g.append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", y(140))
        .attr("y2", y(140))
        .attr("stroke", "orange")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 4");

      // Orange legend
      g.append("line")
        .attr("x1", width - 160)
        .attr("x2", width - 140)
        .attr("y1", 10)
        .attr("y2", 10)
        .attr("stroke", "orange")
        .attr("stroke-dasharray", "5 4")
        .attr("stroke-width", 2);

      g.append("text")
        .attr("x", width - 135)
        .attr("y", 14)
        .attr("fill", "#374151")
        .attr("font-size", "0.9rem")
        .text("Postprandial threshold (140 mg/dL)");

      // Max difference computation
      let maxDiff = 0;
      for (let i = 0; i < datasets[0].length; i++) {
        const g1 = datasets[0][i].glucose;
        const g2 = datasets[1][i].glucose;
        const diff = Math.abs(g1 - g2);
        if (!isNaN(diff) && diff > maxDiff) {
          maxDiff = diff;
        }
      }

      // Bottom-right max difference label
      d3.select("#glucose-trend")
  .append("text")
  .attr("x", +d3.select("#glucose-trend").attr("width") - 20)
  .attr("y", +d3.select("#glucose-trend").attr("height") - 10)
  .attr("text-anchor", "end")
  .attr("fill", "#fca5a5") // even softer red
  .attr("font-weight", "400")
  .attr("font-size", "14px")
  .text(`Max glucose difference: ${maxDiff.toFixed(1)} mg/dL`);



      datasets.forEach((dataset, i) => {
        const line = d3.line()
          .x(d => x(d.minutes_after_meal))
          .y(d => y(d.glucose));

        g.append("path")
          .datum(dataset)
          .attr("fill", "none")
          .attr("stroke", selectionColor(i))
          .attr("stroke-width", 2)
          .attr("d", line)
          .attr("stroke-dasharray", function () {
            const length = this.getTotalLength();
            return `${length} ${length}`;
          })
          .attr("stroke-dashoffset", function () {
            return this.getTotalLength();
          })
          .transition()
          .duration(2500)
          .attr("stroke-dashoffset", 0);
      });
    }).catch(err => {
      console.error("Error loading glucose trend data:", err);
    });
  }
});
