import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const svg = d3.select("#chart");
const margin = { top: 60, right: 0, bottom: 40, left: 60 };
const width = +svg.attr("width") - margin.left - margin.right;
const height = +svg.attr("height") - margin.top - margin.bottom;
const chartGroup = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

chartGroup.selectAll(".axis-label").remove();

chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("x", width / 2)
  .attr("y", height + 40)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .text("Time of Day");

chartGroup.append("text")
  .attr("class", "axis-label")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -45)
  .attr("text-anchor", "middle")
  .attr("font-size", "14px")
  .text("Glucose Level (mg/dL)");

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
  .attr("class", "tooltip")
  .style("opacity", 0)
  .style("position", "absolute")
  .style("pointer-events", "none")
  .style("background", "#fff")
  .style("padding", "0.5em 0.75em")
  .style("border-radius", "6px")
  .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
  .style("font-size", "0.9rem");

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

const explanationMap = {
  "normal": "This person maintains glucose levels mostly within the healthy fasting range throughout the day, with controlled responses to food. We notice that glucose levels rise after meals but return to baseline quickly, indicating good glucose regulation. Also, their fluctuation is minimal, suggesting stable insulin response.",
  "prediabetic": "Based on intuition, many people might think this individual is diabetic due to the frequent and relatively large spikes in glucose levels. However, they are actually <strong>prediabetic</strong>, which means their glucose levels are higher than normal but not high enough to be classified as diabetic. As we see, this individual is somewhat half and half within the green and yellow zones during their fasting periods and most spikes actually have to do with the fact that this individual eats frequently.",
  "diabetic": "Many people might think this person is prediabetic due to their relatively constant fasting glucose levels but high average glucose than the normal individual, but they are actually <strong>diabetic</strong>. This is more or less evident from the consistently high glucose levels throughout the day (majority in the yellow zone and occasionally the red). In other words, the glucose levels remain elevated for extended periods, indicating poor glucose regulation and insulin response."
};

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
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
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

    const focus = chartGroup.append("g").style("display", "none");
    focus.append("circle").attr("r", 4.5).attr("fill", "#1e3a8a");

    svg.on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const xm = x.invert(mx - margin.left);
      const bisect = d3.bisector(d => d.time).left;
      const i = bisect(data, xm, 1);
      const d0 = data[i - 1], d1 = data[i] || d0;
      const d = xm - d0.time > d1.time - xm ? d1 : d0;

      focus.style("display", null)
        .attr("transform", `translate(${x(d.time)},${y(d.glucose)})`);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d3.timeFormat("%-I:%M %p")(d.time)}</strong><br/>
          Glucose: ${d.glucose} mg/dL<br/>
          ${d.logged_food ? `
            <br/><strong>Food:</strong> ${d.logged_food}<br/>
            Calories: ${d.calorie} kcal<br/>
            Carbs: ${d.total_carb}g<br/>
            Sugar: ${d.sugar}g<br/>
            Protein: ${d.protein}g
          ` : ""}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    });

    svg.on("mouseleave", () => {
      focus.style("display", "none");
      tooltip.style("opacity", 0);
    });
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

    // Explanation below chart
    container.append("p")
      .attr("class", "result-explanation")
      .style("margin-top", "1rem")
      .style("font-size", "0.95rem")
      .style("color", "#374151")
      .html(`${explanationMap[correctLabel.toLowerCase()]}`);
  });
    // Final takeaway section
    section.append("div")
      .style("padding", "2rem")
      .style("margin-top", "3rem")
      .style("background", "#f0f9ff")
      .style("border-radius", "16px")
      .style("box-shadow", "0 8px 24px rgba(0, 0, 0, 0.06)")
      .html(`
        <h3 style="margin-bottom: 1rem; color: #1e3a8a;">Important Takeaways</h3>
        <p style="margin-bottom: 1rem;">
          From what we saw above, not only can glucose trends vary significantly between individuals, they can also be somewhat misleading. While using wearable devices to monitor glucose levels is helpful to get an idea of where you might fall in terms of diabetes, just monitoring glucose trends of an individual on a day-to-day basis is likely not enough for a self-diagnosis. Oftentimes, getting medically tested for HbA1c is a better way to get a more accurate picture of one's glucose regulation.
        </p>
        <p style="margin-bottom: 1rem;">
          That said, even individuals with the same HbA1c can have very different glucose trends and responses to the same food as we will see in the next page. This is because HbA1c is an average measure of glucose levels over a period of time (typically 2-3 months), while daily glucose trends can fluctuate significantly based on diet, activity, stress, and other factors. Therefore, it's important to consider both HbA1c and daily glucose patterns when assessing one's glucose health.
        </p>
      `);
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

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom + 10)
      .attr("fill", "#374151")
      .attr("font-size", "0.9rem")
      .text("Time of Day");

    g.append("g").call(d3.axisLeft(y));

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

    // === Tooltip and hover dot ===
    const focus = g.append("g").style("display", "none");
    focus.append("circle")
      .attr("r", 4.5)
      .attr("fill", "#1e3a8a");

    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "#fff")
      .style("padding", "0.5em 0.75em")
      .style("border-radius", "6px")
      .style("box-shadow", "0 2px 8px rgba(0,0,0,0.1)")
      .style("font-size", "0.9rem");

    svg.on("mousemove", function (event) {
      const [mx] = d3.pointer(event, this);
      const xm = x.invert(mx - margin.left);
      const bisect = d3.bisector(d => d.time).left;
      const i = bisect(data, xm, 1);
      const d0 = data[i - 1], d1 = data[i] || d0;
      const d = xm - d0.time > d1.time - xm ? d1 : d0;

      focus.style("display", null)
           .attr("transform", `translate(${x(d.time)},${y(d.glucose)})`);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d3.timeFormat("%-I:%M %p")(d.time)}</strong><br/>
          Glucose: ${d.glucose} mg/dL<br/>
          ${d.logged_food ? `
            <br/><strong>Food:</strong> ${d.logged_food}<br/>
            Calories: ${d.calorie} kcal<br/>
            Carbs: ${d.total_carb}g<br/>
            Sugar: ${d.sugar}g<br/>
            Protein: ${d.protein}g
          ` : ""}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    });

    svg.on("mouseleave", () => {
      focus.style("display", "none");
      tooltip.style("opacity", 0);
    });
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

