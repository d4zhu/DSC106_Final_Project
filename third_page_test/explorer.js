import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const svg = d3.select("#chart");
const margin = { top: 60, right: 0, bottom: 40, left: 60 };
const width = +svg.attr("width") - margin.left - margin.right;
const height = +svg.attr("height") - margin.top - margin.bottom;
const chartGroup = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

 // ===== AXIS LABELS =====
chartGroup.selectAll(".axis-label").remove();

// X-axis label
chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("x", width / 2)
  .attr("y", height + 40)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .text("Time of Day");

// Y-axis label
chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -45)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .text("Glucose Level (mg/dL)");

// ===== LEGEND =====
svg.selectAll(".legend").remove();
const legend = svg.append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${margin.left}, 20)`);

legend.append("line")
  .attr("x1", 0).attr("x2", 20)
  .attr("y1", 0).attr("y2", 0)
  .attr("stroke", "#3b82f6")
  .attr("stroke-width", 2);

legend.append("text")
  .attr("x", 30)
  .attr("y", 5)
  .attr("font-size", "12px")
  .text("Glucose Level");

legend.append("line")
  .attr("x1", 0).attr("x2", 20)
  .attr("y1", 20).attr("y2", 20)
  .attr("stroke", "#f59e0b")
  .attr("stroke-width", 1)
  .attr("stroke-dasharray", "4 2");

legend.append("text")
  .attr("x", 30)
  .attr("y", 25)
  .attr("font-size", "12px")
  .text("Food Logged");

const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip").style("opacity", 0);

const x = d3.scaleTime().range([0, width]);
const y = d3.scaleLinear().range([height, 0]).domain([50, 230]);

const line = d3.line()
  .x(d => x(d.time))
  .y(d => y(d.glucose))
  .curve(d3.curveMonotoneX);

const xAxis = chartGroup.append("g").attr("transform", `translate(0,${height})`);
const yAxis = chartGroup.append("g").call(d3.axisLeft(y));

const profiles = [
  { id: "01", label: "normal", hba1c: "5.3%" },
  { id: "10", label: "prediabetic", hba1c: "6.2%" },
  { id: "04", label: "diabetic", hba1c: "7.5%" }
];

let currentProfile = null;
let selectedGuess = null;
const guesses = [];

function loadNext() {
  if (guesses.length === profiles.length) {
    document.getElementById("quiz-section").style.opacity = 0.3;

    const scrollMsg = document.getElementById("scroll-msg");
    scrollMsg.style.display = "block";
    scrollMsg.classList.add("fade-in");

    const results = document.getElementById("results-section");
    results.style.display = "block";
    results.classList.add("fade-in");

    showResults();
    return;
  }

  selectedGuess = null;
  document.querySelectorAll(".quiz-btn").forEach(btn => btn.classList.remove("selected"));
  document.getElementById("next-btn").disabled = true;

  const remainingProfiles = profiles.filter(p => !guesses.find(g => g.id === p.id));
  const randomIndex = Math.floor(Math.random() * remainingProfiles.length);
  currentProfile = remainingProfiles[randomIndex];
  document.getElementById("quiz-progress").textContent = `${guesses.length + 1}/${profiles.length}`;


  d3.json(`../data/${currentProfile.id}_full_day.json`).then(data => {
    data = data.filter(d => d.glucose && d.time);
    data.forEach(d => {
      d.time = d3.timeParse("%H:%M:%S")(d.time);
    });

    x.domain(d3.extent(data, d => d.time));
    xAxis.transition().duration(1000)
      .call(d3.axisBottom(x).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%-I %p")));

    chartGroup.selectAll(".glucose-line").remove();
    const path = chartGroup.append("path")
      .datum(data)
      .attr("class", "glucose-line")
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", line);

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2500)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0);

    chartGroup.selectAll(".food-line").remove();
    chartGroup.selectAll(".food-line")
      .data(data.filter(d => d.logged_food))
      .enter()
      .append("line")
      .attr("class", "food-line")
      .attr("x1", d => x(d.time))
      .attr("x2", d => x(d.time))
      .attr("y1", height / 2)
      .attr("y2", height / 2)
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 2")
      .transition()
      .duration(800)
      .attr("y1", 0)
      .attr("y2", height);
  });
}

document.querySelectorAll(".quiz-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".quiz-btn").forEach(btn => btn.classList.remove("selected"));
    button.classList.add("selected");
    selectedGuess = button.getAttribute("data-answer");
    document.getElementById("next-btn").disabled = false;
  });
});

document.getElementById("next-btn").addEventListener("click", () => {
  if (!selectedGuess || !currentProfile) return;

  guesses.push({
    id: currentProfile.id,
    guess: selectedGuess,
    correctLabel: currentProfile.label
  });

  loadNext();
});

function showResults() {
  const section = d3.select("#results-section");
  section.html("<h3>Results</h3>");

  guesses.forEach(({ id, guess, correctLabel }) => {
    const profile = profiles.find(p => p.id === id);
    const container = section.append("div")
      .style("margin-bottom", "6rem")
      .style("padding", "1rem")
      .style("background", "#f9fafb")
      .style("border-radius", "16px")
      .style("box-shadow", "0 8px 24px rgba(0, 0, 0, 0.08)");

    container.append("p")
      .html(`<strong>Participant ${id}</strong><br/>Your guess: ${guess}<br/>Correct label: ${correctLabel}`)
      .style("color", guess === correctLabel ? "#15803d" : "#b91c1c");

    const canvasId = `chart-${id}`;
    container.append("svg")
      .attr("id", canvasId)
      .attr("width", 1000)
      .attr("height", 450);

    renderResultChart(canvasId, id, profile?.hba1c);
  });
}

function renderResultChart(canvasId, personId, hba1c) {
  d3.json(`../data/${personId}_full_day.json`).then(data => {
    data = data.filter(d => d.glucose && d.time);
    data.forEach(d => {
      d.time = d3.timeParse("%H:%M:%S")(d.time);
    });

    const svg = d3.select(`#${canvasId}`);
    svg.selectAll("*").remove();

    svg.attr("viewBox", `0 0 1000 400`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const margin = { top: 0, right: 20, bottom: 30, left: 50 };
    const width = 975 - margin.left - margin.right;
    const height = 410 - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime().range([0, width]).domain(d3.extent(data, d => d.time));
    const y = d3.scaleLinear().range([height, 0]).domain([50, 230]);

    const line = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.glucose))
      .curve(d3.curveMonotoneX);

    g.append("g").attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(d3.timeHour.every(2)).tickFormat(d3.timeFormat("%-I %p")));

    // X-axis label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom + 10)
      .attr("fill", "#374151")
      .attr("font-size", "0.9rem")
      .text("Time of Day");

    g.append("g").call(d3.axisLeft(y));
        
    // Y-axis label
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -height / 2)
      .attr("y", -margin.left + 15)
      .attr("fill", "#374151")
      .attr("font-size", "0.9rem")
      .text("Glucose Level (mg/dL)");

    const zoneDefs = [
      { min: 70, max: 99, color: "#d1fae5" },
      { min: 100, max: 125, color: "#fef3c7" },
      { min: 126, max: 230, color: "#fee2e2" }
    ];
    zoneDefs.forEach(zone => {
      g.append("rect")
        .attr("x", 0)
        .attr("y", y(zone.max))
        .attr("width", width)
        .attr("height", y(zone.min) - y(zone.max))
        .attr("fill", zone.color)
        .attr("opacity", 0.4);
    });

    const path = g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 2)
      .attr("d", line);

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0);

    g.selectAll(".food-line")
      .data(data.filter(d => d.logged_food))
      .enter()
      .append("line")
      .attr("class", "food-line")
      .attr("x1", d => x(d.time))
      .attr("x2", d => x(d.time))
      .attr("y1", height / 2)
      .attr("y2", height / 2)
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 2")
      .transition()
      .duration(800)
      .attr("y1", 0)
      .attr("y2", height);

    g.append("text")
      .attr("x", width - 10)
      .attr("y", 30)
      .attr("text-anchor", "end")
      .attr("fill", "#6b7280")
      .attr("font-size", "1rem")
      .text(`HbA1c: ${hba1c || 'N/A'}`);
  });
}

loadNext();

const mashImage = document.getElementById("mash-potato");
const mashHint = document.getElementById("mash-hint");
let poked = false;

if (mashImage && mashHint) {
  mashImage.addEventListener("click", () => {
    poked = !poked;
    mashImage.src = poked ? "../assets/mash_nerd_poke.png" : "../assets/mash_default.png";
    mashHint.classList.toggle("visible");
  });
}

