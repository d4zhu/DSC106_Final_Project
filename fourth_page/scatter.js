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

    const margin = { top: 20, right: 40, bottom: 30, left: 90 },
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

      g.append("rect")
        .attr("clip-path", "url(#clip-area)")
        .attr("x", 0)
        .attr("y", y(140))
        .attr("width", width)
        .attr("height", y(70) - y(140))
        .attr("fill", "#d1fae5")
        .attr("opacity", 0.2);

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
