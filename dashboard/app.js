const state = {
  ddragon: {
    version: null,
    champions: [],
    items: [],
    championTags: [],
    itemTags: [],
  },
  players: [],
  selectedPlayer: null,
  esports: {
    years: [],
    leagues: [],
    selectedYears: [],
    selectedLeagues: [],
  },
};

const palette = [
  "#f08f5f",
  "#64d2c4",
  "#f2c14e",
  "#6b9ac4",
  "#e06c9f",
  "#c3f584",
  "#f28f8f",
  "#f5d0c5",
];

function $(selector) {
  return document.querySelector(selector);
}

function setStatus(text) {
  $("#global-status").textContent = text;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

function buildQuery(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || "")}`)
    .join("&");
}

function setupTabs(rootSelector, panelSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) return;
  root.addEventListener("click", (event) => {
    const button = event.target.closest(".tab");
    if (!button) return;
    const tab = button.dataset.tab;
    root.querySelectorAll(".tab").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    const panels = root.parentElement.querySelectorAll(panelSelector);
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tabPanel === tab);
    });
  });
}

function clear(container) {
  container.innerHTML = "";
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatInteger(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return Math.round(Number(value)).toString();
}

function formatDurationMs(ms) {
  if (!ms) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function createSvg(width, height) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  return svg;
}

function getChartSize(container, defaultWidth = 620, defaultHeight = 340) {
  const rect = container.getBoundingClientRect();
  const width = Math.max(defaultWidth, rect.width || defaultWidth);
  return { width, height: defaultHeight };
}

function truncateLabel(label, maxLength = 14) {
  if (!label) return "";
  return label.length > maxLength ? `${label.slice(0, maxLength - 3)}...` : label;
}

function scaleLinear(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;
  return (value) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

function renderScatter(container, points, options = {}) {
  clear(container);
  if (!points.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container);
  const padding = 40;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xScale = scaleLinear(minX, maxX, padding, width - padding);
  const yScale = scaleLinear(minY, maxY, height - padding, padding);
  const svg = createSvg(width, height);
  drawAxes(svg, width, height, padding, minX, maxX, minY, maxY, options);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.style.display = "none";
  container.appendChild(tooltip);

  points.forEach((point, idx) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", xScale(point.x));
    circle.setAttribute("cy", yScale(point.y));
    circle.setAttribute("r", 4 + (point.size || 0) * 0.02);
    circle.setAttribute("fill", point.color || "#f08f5f");
    circle.setAttribute("opacity", "0.8");
    if (options.onSelect) {
      circle.style.cursor = "pointer";
      circle.addEventListener("click", () => options.onSelect(point, idx));
    }
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = point.label || "";
    circle.appendChild(title);
    circle.addEventListener("mouseenter", () => {
      tooltip.textContent = point.label || "";
      tooltip.style.display = "block";
    });
    circle.addEventListener("mousemove", (event) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - rect.left + 12}px`;
      tooltip.style.top = `${event.clientY - rect.top + 12}px`;
    });
    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

function renderBar(container, data, options = {}) {
  clear(container);
  if (!data.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container);
  const padding = 50;
  const maxValue = Math.max(...data.map((d) => d.value));
  const labelPadding = 140;
  const xScale = scaleLinear(0, maxValue, labelPadding, width - padding);
  const barHeight = (height - padding * 2) / data.length;
  const svg = createSvg(width, height);
  drawBarAxis(svg, width, height, padding, options);

  data.forEach((d, idx) => {
    const y = padding + idx * barHeight;
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", labelPadding);
    bar.setAttribute("y", y + 4);
    bar.setAttribute("width", xScale(d.value) - labelPadding);
    bar.setAttribute("height", Math.max(6, barHeight - 8));
    bar.setAttribute("fill", d.color || palette[idx % palette.length]);
    bar.setAttribute("rx", "6");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", labelPadding - 8);
    label.setAttribute("y", y + barHeight / 2 + 4);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "end");
    label.textContent = truncateLabel(d.label, 16);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = d.label;
    label.appendChild(title);

    const value = document.createElementNS("http://www.w3.org/2000/svg", "text");
    value.setAttribute("x", xScale(d.value) + 6);
    value.setAttribute("y", y + barHeight / 2 + 4);
    value.setAttribute("fill", "#a9b4c5");
    value.setAttribute("font-size", "11");
    value.textContent = options.format ? options.format(d.value) : formatNumber(d.value, 0);

    svg.appendChild(bar);
    svg.appendChild(label);
    svg.appendChild(value);
  });

  container.appendChild(svg);
}

function renderLine(container, points, options = {}) {
  clear(container);
  if (!points.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container);
  const padding = 40;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xScale = scaleLinear(minX, maxX, padding, width - padding);
  const yScale = scaleLinear(minY, maxY, height - padding, padding);
  const svg = createSvg(width, height);
  drawAxes(svg, width, height, padding, minX, maxX, minY, maxY, options);

  if (points.length > 1) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const d = points
      .map((point, idx) => {
        const x = xScale(point.x);
        const y = yScale(point.y);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", options.color || "#64d2c4");
    path.setAttribute("stroke-width", "2");
    svg.appendChild(path);
  }

  points.forEach((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", xScale(point.x));
    circle.setAttribute("cy", yScale(point.y));
    circle.setAttribute("r", points.length === 1 ? "6" : "3");
    circle.setAttribute("fill", options.color || "#64d2c4");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${point.x}: ${formatNumber(point.y, 2)}`;
    circle.appendChild(title);
    svg.appendChild(circle);

    if (points.length === 1) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", xScale(point.x) + 8);
      label.setAttribute("y", yScale(point.y) - 8);
      label.setAttribute("fill", "#e8edf5");
      label.setAttribute("font-size", "11");
      label.textContent = formatNumber(point.y, 0);
      svg.appendChild(label);
    }
  });

  container.appendChild(svg);
}

function renderRadar(container, metrics) {
  clear(container);
  if (!metrics.length) {
    container.textContent = "No data.";
    return;
  }
  const width = 360;
  const height = 320;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 90;
  const svg = createSvg(width, height);
  const maxValue = Math.max(...metrics.map((m) => m.value)) || 1;

  metrics.forEach((metric, idx) => {
    const angle = (Math.PI * 2 * idx) / metrics.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (radius + 10);
    const y = centerY + Math.sin(angle) * (radius + 10);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y);
    label.setAttribute("fill", "#a9b4c5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "middle");
    label.textContent = metric.label;
    svg.appendChild(label);
  });

  const points = metrics
    .map((metric, idx) => {
      const angle = (Math.PI * 2 * idx) / metrics.length - Math.PI / 2;
      const value = (metric.value / maxValue) * radius;
      const x = centerX + Math.cos(angle) * value;
      const y = centerY + Math.sin(angle) * value;
      return `${x},${y}`;
    })
    .join(" ");

  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", points);
  polygon.setAttribute("fill", "rgba(240, 143, 95, 0.3)");
  polygon.setAttribute("stroke", "#f08f5f");
  polygon.setAttribute("stroke-width", "2");
  svg.appendChild(polygon);

  metrics.forEach((metric, idx) => {
    const angle = (Math.PI * 2 * idx) / metrics.length - Math.PI / 2;
    const value = (metric.value / maxValue) * radius;
    const x = centerX + Math.cos(angle) * value;
    const y = centerY + Math.sin(angle) * value;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", y);
    text.setAttribute("fill", "#f8e6d5");
    text.setAttribute("font-size", "9");
    text.setAttribute("text-anchor", "middle");
    text.textContent = metric.display ?? formatNumber(metric.value, 2);
    svg.appendChild(text);
  });

  container.appendChild(svg);
}

function renderPie(container, data, options = {}) {
  clear(container);
  if (!data.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container, 520, 320);
  const radius = Math.min(width, height) / 2 - 20;
  const svg = createSvg(width, height);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let angle = -Math.PI / 2;
  data.forEach((slice, idx) => {
    const sliceAngle = (slice.value / total) * Math.PI * 2;
    const x1 = width / 2 + radius * Math.cos(angle);
    const y1 = height / 2 + radius * Math.sin(angle);
    const x2 = width / 2 + radius * Math.cos(angle + sliceAngle);
    const y2 = height / 2 + radius * Math.sin(angle + sliceAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${width / 2} ${height / 2} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
    );
    path.setAttribute("fill", slice.color || palette[idx % palette.length]);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${slice.label}: ${slice.value}`;
    path.appendChild(title);
    svg.appendChild(path);
    const midAngle = angle + sliceAngle / 2;
    const labelX = width / 2 + Math.cos(midAngle) * (radius + 18);
    const labelY = height / 2 + Math.sin(midAngle) * (radius + 18);
    const percent = ((slice.value / total) * 100).toFixed(1);
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", labelX);
    label.setAttribute("y", labelY);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "middle");
    label.textContent = `${percent}%`;
    svg.appendChild(label);
    angle += sliceAngle;
  });
  container.appendChild(svg);

  const legendContainer = options.legendContainer;
  if (legendContainer) {
    clear(legendContainer);
    data.forEach((slice) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.background = slice.color;
      const label = document.createElement("span");
      label.textContent = `${slice.label} (${slice.value})`;
      item.appendChild(swatch);
      item.appendChild(label);
      legendContainer.appendChild(item);
    });
  }
}

function renderBoxPlot(container, rows, options = {}) {
  clear(container);
  if (!rows.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container, 520, 320);
  const padding = 40;
  const svg = createSvg(width, height);
  const values = rows.flatMap((row) => [row.p10, row.q1, row.median, row.q3, row.p90]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xScale = scaleLinear(min, max, padding, width - padding);
  const rowHeight = (height - padding * 2) / rows.length;

  rows.forEach((row, idx) => {
    const y = padding + idx * rowHeight + rowHeight / 2;
    const box = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    box.setAttribute("x", xScale(row.q1));
    box.setAttribute("y", y - rowHeight * 0.2);
    box.setAttribute("width", xScale(row.q3) - xScale(row.q1));
    box.setAttribute("height", rowHeight * 0.4);
    box.setAttribute("fill", "rgba(100,210,196,0.3)");
    box.setAttribute("stroke", "#64d2c4");
    svg.appendChild(box);

    const median = document.createElementNS("http://www.w3.org/2000/svg", "line");
    median.setAttribute("x1", xScale(row.median));
    median.setAttribute("x2", xScale(row.median));
    median.setAttribute("y1", y - rowHeight * 0.2);
    median.setAttribute("y2", y + rowHeight * 0.2);
    median.setAttribute("stroke", "#f08f5f");
    median.setAttribute("stroke-width", "2");
    svg.appendChild(median);

    const whisker = document.createElementNS("http://www.w3.org/2000/svg", "line");
    whisker.setAttribute("x1", xScale(row.p10));
    whisker.setAttribute("x2", xScale(row.p90));
    whisker.setAttribute("y1", y);
    whisker.setAttribute("y2", y);
    whisker.setAttribute("stroke", "rgba(255,255,255,0.5)");
    svg.appendChild(whisker);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", padding - 6);
    label.setAttribute("y", y + 4);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "end");
    label.textContent = row.label;
    svg.appendChild(label);
  });

  drawAxes(svg, width, height, padding, min, max, 0, rows.length, { xLabel: options.xLabel || "" });
  container.appendChild(svg);
}

function renderHeatmap(container, data) {
  clear(container);
  if (!data || !data.values || !data.values.length) {
    container.textContent = "No data.";
    return;
  }
  const baseHeight = Math.max(360, data.leagues.length * 26 + 120);
  const { width } = getChartSize(container, 720, baseHeight);
  const height = baseHeight;
  container.style.height = `${height}px`;
  const paddingLeft = 140;
  const paddingTop = 60;
  const svg = createSvg(width, height);
  const rows = data.leagues.length;
  const cols = data.champions.length;
  const cellWidth = (width - paddingLeft * 1.1) / cols;
  const cellHeight = (height - paddingTop * 1.2) / rows;
  const maxValue = Math.max(...data.values.flat());

  data.leagues.forEach((league, r) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", paddingLeft - 10);
    label.setAttribute("y", paddingTop + r * cellHeight + cellHeight / 2 + 4);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "end");
    label.textContent = league;
    svg.appendChild(label);
  });

  data.champions.forEach((champ, c) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", paddingLeft + c * cellWidth + cellWidth / 2);
    label.setAttribute("y", paddingTop - 10);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "middle");
    label.textContent = truncateLabel(champ, 10);
    svg.appendChild(label);
  });

  data.values.forEach((row, r) => {
    row.forEach((value, c) => {
      const intensity = maxValue ? value / maxValue : 0;
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", paddingLeft + c * cellWidth);
      rect.setAttribute("y", paddingTop + r * cellHeight);
      rect.setAttribute("width", cellWidth - 2);
      rect.setAttribute("height", cellHeight - 2);
      rect.setAttribute("fill", `rgba(240,143,95,${0.15 + intensity * 0.7})`);
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${data.leagues[r]} / ${data.champions[c]}: ${value}`;
      rect.appendChild(title);
      svg.appendChild(rect);
    });
  });
  container.appendChild(svg);
}

function renderSankey(container, data) {
  clear(container);
  if (!data || !data.links || !data.links.length) {
    container.textContent = "No data.";
    return;
  }
  const { width, height } = getChartSize(container, 640, 360);
  const svg = createSvg(width, height);
  const leftX = 120;
  const rightX = width - 120;
  const leftNodes = data.positions;
  const rightNodes = data.champions;
  const maxValue = Math.max(...data.links.map((l) => l.value));

  leftNodes.forEach((pos, idx) => {
    const y = 60 + idx * ((height - 120) / (leftNodes.length - 1 || 1));
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", leftX - 10);
    text.setAttribute("y", y);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("fill", "#e8edf5");
    text.setAttribute("font-size", "11");
    text.textContent = pos.toUpperCase();
    svg.appendChild(text);
  });

  rightNodes.forEach((champ, idx) => {
    const y = 40 + idx * ((height - 80) / (rightNodes.length - 1 || 1));
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", rightX + 10);
    text.setAttribute("y", y);
    text.setAttribute("text-anchor", "start");
    text.setAttribute("fill", "#e8edf5");
    text.setAttribute("font-size", "10");
    text.textContent = truncateLabel(champ, 12);
    svg.appendChild(text);
  });

  data.links.forEach((link) => {
    const y1 = 60 + link.sourceIndex * ((height - 120) / (leftNodes.length - 1 || 1));
    const y2 = 40 + link.targetIndex * ((height - 80) / (rightNodes.length - 1 || 1));
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const thickness = 1 + (link.value / maxValue) * 12;
    path.setAttribute("d", `M ${leftX} ${y1} C ${(leftX + rightX) / 2} ${y1}, ${(leftX + rightX) / 2} ${y2}, ${rightX} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(100,210,196,0.5)");
    path.setAttribute("stroke-width", thickness);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${leftNodes[link.sourceIndex]} -> ${rightNodes[link.targetIndex]}: ${link.value}`;
    path.appendChild(title);
    svg.appendChild(path);
  });

  container.appendChild(svg);
}

function drawAxes(svg, width, height, padding, minX, maxX, minY, maxY, options = {}) {
  const axis = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const axisColor = "rgba(255,255,255,0.25)";
  const xLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  xLine.setAttribute("x1", padding);
  xLine.setAttribute("y1", height - padding);
  xLine.setAttribute("x2", width - padding);
  xLine.setAttribute("y2", height - padding);
  xLine.setAttribute("stroke", axisColor);
  xLine.setAttribute("stroke-width", "1");
  axis.appendChild(xLine);

  const yLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  yLine.setAttribute("x1", padding);
  yLine.setAttribute("y1", height - padding);
  yLine.setAttribute("x2", padding);
  yLine.setAttribute("y2", padding);
  yLine.setAttribute("stroke", axisColor);
  yLine.setAttribute("stroke-width", "1");
  axis.appendChild(yLine);

  const ticks = 3;
  for (let i = 0; i <= ticks; i += 1) {
    const x = padding + ((width - padding * 2) / ticks) * i;
    const y = height - padding + 12;
    const value = minX + ((maxX - minX) / ticks) * i;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y);
    label.setAttribute("fill", "#a9b4c5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "middle");
    label.textContent = formatNumber(value, 1);
    axis.appendChild(label);

    const yTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yTick.setAttribute("x1", x);
    yTick.setAttribute("y1", height - padding);
    yTick.setAttribute("x2", x);
    yTick.setAttribute("y2", height - padding + 4);
    yTick.setAttribute("stroke", axisColor);
    axis.appendChild(yTick);
  }

  for (let i = 0; i <= ticks; i += 1) {
    const y = height - padding - ((height - padding * 2) / ticks) * i;
    const x = padding - 6;
    const value = minY + ((maxY - minY) / ticks) * i;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y + 4);
    label.setAttribute("fill", "#a9b4c5");
    label.setAttribute("font-size", "10");
    label.setAttribute("text-anchor", "end");
    label.textContent = formatNumber(value, 1);
    axis.appendChild(label);

    const xTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xTick.setAttribute("x1", padding - 4);
    xTick.setAttribute("y1", y);
    xTick.setAttribute("x2", padding);
    xTick.setAttribute("y2", y);
    xTick.setAttribute("stroke", axisColor);
    axis.appendChild(xTick);
  }

  if (options.xLabel) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", width - padding);
    label.setAttribute("y", height - 6);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "end");
    label.textContent = options.xLabel;
    axis.appendChild(label);
  }

  if (options.yLabel) {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", padding);
    label.setAttribute("y", 12);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "11");
    label.textContent = options.yLabel;
    axis.appendChild(label);
  }

  svg.appendChild(axis);
}

function drawBarAxis(svg, width, height, padding, options = {}) {
  if (!options.xLabel) return;
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", width - padding);
  label.setAttribute("y", height - 6);
  label.setAttribute("fill", "#e8edf5");
  label.setAttribute("font-size", "11");
  label.setAttribute("text-anchor", "end");
  label.textContent = options.xLabel;
  svg.appendChild(label);
}

function renderTable(container, columns, rows) {
  clear(container);
  if (!rows.length) {
    container.textContent = "No data.";
    return;
  }
  const header = document.createElement("div");
  header.className = "row header";
  columns.forEach((col) => {
    const cell = document.createElement("div");
    cell.textContent = col.label;
    header.appendChild(cell);
  });
  container.appendChild(header);
  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    columns.forEach((col) => {
      const cell = document.createElement("div");
      cell.textContent = col.render ? col.render(row[col.key], row) : row[col.key] ?? "-";
      rowEl.appendChild(cell);
    });
    container.appendChild(rowEl);
  });
}

function buildTags(container, tags, onToggle) {
  clear(container);
  tags.forEach((tag) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = tag;
    chip.addEventListener("click", () => onToggle(tag, chip));
    container.appendChild(chip);
  });
}

function updateVersionList(versions, selected) {
  const container = $("#version-list");
  clear(container);
  versions.forEach((version) => {
    const item = document.createElement("div");
    item.className = "list-item" + (version === selected ? " active" : "");
    item.textContent = version;
    item.addEventListener("click", () => {
      state.ddragon.version = version;
      loadChampions();
      loadItems();
      updateVersionList(versions, version);
    });
    container.appendChild(item);
  });
}

async function loadDdragonMeta() {
  const data = await fetchJson("/api/ddragon/meta");
  state.ddragon.version = data.selectedVersion;
  $("#current-version").textContent = data.selectedVersion || "-";
  $("#current-realm").textContent = data.realms.v ? `Realm: ${data.realms.v}` : "Realm: -";
  updateVersionList(data.versions || [], data.selectedVersion);
  await loadChampions();
  await loadItems();
}

async function loadChampions() {
  if (!state.ddragon.version) return;
  const data = await fetchJson(`/api/ddragon/champions?version=${state.ddragon.version}`);
  state.ddragon.champions = data.items || [];
  const tags = new Set();
  state.ddragon.champions.forEach((champ) => {
    champ.tags.forEach((tag) => tags.add(tag));
  });
  state.ddragon.championTags = ["All", ...Array.from(tags).sort()];
  state.ddragon.tagColors = {};
  Array.from(tags).sort().forEach((tag, idx) => {
    state.ddragon.tagColors[tag] = palette[idx % palette.length];
  });
  const tagSelect = $("#champion-tag");
  tagSelect.innerHTML = "";
  state.ddragon.championTags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagSelect.appendChild(option);
  });
  tagSelect.value = "All";
  renderChampionScatter();
}

function renderChampionScatter() {
  const tagFilter = $("#champion-tag").value;
  const points = state.ddragon.champions
    .filter((champ) => tagFilter === "All" || champ.tags.includes(tagFilter))
    .map((champ, idx) => ({
      x: champ.stats.attackdamage,
      y: champ.stats.hp,
      size: champ.stats.movespeed,
      color: state.ddragon.tagColors[champ.tags[0]] || palette[idx % palette.length],
      label: `${champ.name} | AD ${champ.stats.attackdamage} | HP ${champ.stats.hp}`,
      data: champ,
    }));
  renderScatter($("#champion-scatter"), points, {
    onSelect: (point) => updateChampionDetail(point.data),
    xLabel: "Base Attack Damage",
    yLabel: "Base HP",
  });
  renderChampionLegend(tagFilter);
}

function renderChampionLegend(tagFilter) {
  const legend = $("#champion-legend");
  clear(legend);
  const tags = tagFilter === "All" ? Object.keys(state.ddragon.tagColors) : [tagFilter];
  tags.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = state.ddragon.tagColors[tag];
    const label = document.createElement("span");
    label.textContent = tag;
    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });
}
function updateChampionDetail(champ) {
  const detail = $("#champion-detail .detail");
  $("#champion-detail .placeholder").classList.add("hidden");
  detail.classList.remove("hidden");
  $("#champion-name").textContent = champ.name;
  $("#champion-title").textContent = champ.title;
  $("#champion-blurb").textContent = champ.blurb || "";
  const tags = $("#champion-tags");
  clear(tags);
  champ.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tags.appendChild(span);
  });
  const stats = $("#champion-stats");
  clear(stats);
  const statEntries = [
    ["HP", champ.stats.hp],
    ["Attack Damage", champ.stats.attackdamage],
    ["Armor", champ.stats.armor],
    ["Magic Resist", champ.stats.spellblock],
    ["Move Speed", champ.stats.movespeed],
  ];
  statEntries.forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="label">${label}</div><div class="value">${formatNumber(value, 0)}</div>`;
    stats.appendChild(card);
  });
  renderChampionGrowth(champ);
}

function renderChampionGrowth(champ) {
  const metrics = [
    { key: "hp", label: "HP" },
    { key: "attackdamage", label: "Attack" },
    { key: "armor", label: "Armor" },
    { key: "spellblock", label: "MR" },
  ];
  const bars = metrics.map((metric) => {
    const base = champ.stats[metric.key] || 0;
    const perLevel = champ.stats[`${metric.key}perlevel`] || 0;
    const level18 = base + 17 * perLevel;
    return {
      label: metric.label,
      value: level18 - base,
    };
  });
  renderBar($("#champion-growth"), bars, { xLabel: "Delta (Lv1 -> Lv18)" });
}

async function loadItems() {
  if (!state.ddragon.version) return;
  const data = await fetchJson(`/api/ddragon/items?version=${state.ddragon.version}`);
  state.ddragon.items = data.items || [];
  const tags = new Set();
  state.ddragon.items.forEach((item) => {
    item.tags.forEach((tag) => tags.add(tag));
  });
  state.ddragon.itemTags = Array.from(tags).sort();
  const tagContainer = $("#item-tags");
  buildTags(tagContainer, state.ddragon.itemTags, toggleItemTag);
  renderItemScatter();
}

function toggleItemTag(tag, chip) {
  chip.classList.toggle("active");
  renderItemScatter();
}

function getSelectedItemTags() {
  return Array.from($("#item-tags").querySelectorAll(".chip.active")).map((chip) => chip.textContent);
}

function renderItemScatter() {
  const metric = $("#item-stat").value;
  const selectedTags = getSelectedItemTags();
  const items = state.ddragon.items.filter((item) => {
    if (!selectedTags.length) return true;
    return item.tags.some((tag) => selectedTags.includes(tag));
  });
  const scored = items
    .filter((item) => (item.gold?.total || 0) > 0)
    .map((item) => {
      const stat = item.simpleStats[metric] || 0;
      const gold = item.gold?.total || 1;
      return {
        item,
        efficiency: stat / gold,
        stat,
        gold,
      };
    })
    .filter((entry) => entry.stat > 0)
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 15);
  renderBar(
    $("#item-scatter"),
    scored.map((entry) => ({
      label: entry.item.name,
      value: entry.efficiency * 1000,
      data: entry.item,
    })),
    { xLabel: `${metric} per 1000 gold` }
  );
  const container = $("#item-scatter");
  container.querySelectorAll("rect").forEach((rect, idx) => {
    rect.style.cursor = "pointer";
    rect.addEventListener("click", () => updateItemDetail(scored[idx].item));
  });
}

function updateItemDetail(item) {
  const detail = $("#item-detail .detail");
  $("#item-detail .placeholder").classList.add("hidden");
  detail.classList.remove("hidden");
  $("#item-name").textContent = item.name;
  $("#item-cost").textContent = `Total Gold: ${item.gold?.total || 0}`;
  const tagContainer = $("#item-tags-display");
  clear(tagContainer);
  item.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagContainer.appendChild(span);
  });
  const stats = $("#item-stats");
  clear(stats);
  const statEntries = [
    ["Attack Damage", item.simpleStats.attackDamage],
    ["Ability Power", item.simpleStats.abilityPower],
    ["Armor", item.simpleStats.armor],
    ["Magic Resist", item.simpleStats.magicResist],
    ["Health", item.simpleStats.health],
    ["Attack Speed", item.simpleStats.attackSpeed],
  ];
  statEntries.forEach(([label, value]) => {
    if (!value) return;
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<div class="label">${label}</div><div class="value">${formatNumber(value, 2)}</div>`;
    stats.appendChild(card);
  });
  const idToName = new Map(state.ddragon.items.map((it) => [it.id, it.name]));
  renderPills($("#item-from"), item.from || [], idToName);
  renderPills($("#item-into"), item.into || [], idToName);
}

function renderPills(container, items, idToName) {
  clear(container);
  if (!items.length) {
    container.textContent = "None";
    return;
  }
  items.forEach((id) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = idToName.get(id) || id;
    container.appendChild(pill);
  });
}

async function loadPlayers() {
  const data = await fetchJson("/api/lolapi/players");
  state.players = data.players || [];
  const select = $("#player-select");
  select.innerHTML = "";
  state.players.forEach((player) => {
    const option = document.createElement("option");
    option.value = player.puuid;
    option.textContent = player.gameName ? `${player.gameName}#${player.tagLine}` : player.puuid;
    select.appendChild(option);
  });
  if (state.players.length) {
    state.selectedPlayer = state.players[0].puuid;
    select.value = state.selectedPlayer;
    await refreshPlayer();
  }
}

async function refreshPlayer() {
  const puuid = state.selectedPlayer;
  if (!puuid) return;
  const [profile, mastery, challenges, matches, stateInfo] = await Promise.all([
    fetchJson(`/api/lolapi/player/${puuid}/profile`),
    fetchJson(`/api/lolapi/player/${puuid}/mastery?top=${$("#mastery-top").value}`),
    fetchJson(`/api/lolapi/player/${puuid}/challenges`),
    fetchJson(`/api/lolapi/player/${puuid}/matches?limit=${$("#match-limit").value}`),
    fetchJson("/api/lolapi/state"),
  ]);
  updatePlayerProfile(profile, stateInfo);
  renderMastery(mastery.items || []);
  renderChallenges(challenges);
  renderMatches(matches.items || []);
}

function updatePlayerProfile(profile, stateInfo) {
  const profileCard = $("#player-profile");
  const rankedCard = $("#player-ranked");
  const account = profile.account || {};
  const summoner = profile.summoner || {};
  profileCard.innerHTML = `
    <h3>Player Overview</h3>
    <div class="stats">
      <div class="stat-card"><div class="label">Riot ID</div><div class="value">${account.gameName || "-"}#${account.tagLine || ""}</div></div>
      <div class="stat-card"><div class="label">Summoner</div><div class="value">${summoner.name || "-"}</div></div>
      <div class="stat-card"><div class="label">Level</div><div class="value">${summoner.summonerLevel || "-"}</div></div>
      <div class="stat-card"><div class="label">PUUID</div><div class="value">${account.puuid ? account.puuid.slice(0, 10) + "..." : "-"}</div></div>
    </div>
  `;
  if (profile.ranked && profile.ranked.length) {
    const queue = profile.ranked[0];
    rankedCard.innerHTML = `
      <h3>Ranked Snapshot</h3>
      <div class="stats">
        <div class="stat-card"><div class="label">Tier</div><div class="value">${queue.tier || "-"} ${queue.rank || ""}</div></div>
        <div class="stat-card"><div class="label">LP</div><div class="value">${queue.leaguePoints ?? "-"}</div></div>
        <div class="stat-card"><div class="label">Wins</div><div class="value">${queue.wins ?? "-"}</div></div>
        <div class="stat-card"><div class="label">Losses</div><div class="value">${queue.losses ?? "-"}</div></div>
      </div>
    `;
  } else {
    rankedCard.innerHTML = `<h3>Ranked Snapshot</h3><div class="placeholder">Ranked data unavailable.</div>`;
  }
  if (stateInfo?.last_run_time) {
    const date = new Date(stateInfo.last_run_time * 1000);
    $("#player-update").textContent = `Last update: ${date.toLocaleString()}`;
  }
}

function renderMastery(items) {
  const bars = items.map((item) => ({
    label: item.championName,
    value: item.championPoints,
  }));
  const topN = parseInt($("#mastery-top").value, 10) || 10;
  renderBar($("#mastery-bar"), bars.slice(0, Math.min(topN, 15)), { xLabel: "Champion Points" });
  renderTable(
    $("#mastery-table"),
    [
      { label: "Champion", key: "championName" },
      { label: "Points", key: "championPoints", render: (v) => formatInteger(v) },
      { label: "Level", key: "championLevel" },
    ],
    items
  );
}

function renderChallenges(challenges) {
  const categories = challenges.categoryPoints || {};
  const metrics = Object.keys(categories).map((key) => ({
    label: key,
    value: categories[key].current || 0,
  }));
  renderRadar($("#challenge-radar"), metrics);
  const rows = (challenges.challenges || []).slice(0, 10).map((entry) => ({
    challengeId: entry.challengeId,
    level: entry.level,
    value: entry.value,
  }));
  renderTable(
    $("#challenge-table"),
    [
      { label: "ID", key: "challengeId" },
      { label: "Level", key: "level" },
      { label: "Value", key: "value", render: (v) => formatNumber(v, 0) },
    ],
    rows
  );
}

function renderMatches(matches) {
  const metric = $("#match-metric").value;
  const points = matches.map((match, idx) => {
    const kda = match.deaths ? (match.kills + match.assists) / Math.max(1, match.deaths) : 0;
    return {
      x: idx + 1,
      y: metric === "kda" ? kda : match[metric] ?? 0,
    };
  });
  renderLine($("#match-line"), points, {
    color: "#f2c14e",
    xLabel: "Match Index",
    yLabel: $("#match-metric").value.toUpperCase(),
  });
  renderTable(
    $("#match-table"),
    [
      { label: "Match", key: "matchId" },
      { label: "Source", key: "source" },
      { label: "Champion", key: "championName" },
      { label: "K/D/A", key: "kills", render: (_, row) => `${row.kills ?? 0}/${row.deaths ?? 0}/${row.assists ?? 0}` },
      { label: "Duration", key: "durationMs", render: (v) => formatDurationMs(v) },
    ],
    matches
  );
}

async function loadEsportsMeta() {
  const data = await fetchJson("/api/esports/meta");
  state.esports.years = data.years || [];
  state.esports.leagues = data.leagues || [];
  state.esports.selectedYears = state.esports.years.slice(-1);
  state.esports.selectedLeagues = [];
  renderChips($("#esports-years"), state.esports.years, state.esports.selectedYears);
  renderChips($("#esports-leagues"), state.esports.leagues, state.esports.selectedLeagues);
  await loadEsportsOverview();
  await loadEsportsTeams();
  await loadEsportsPlayers();
  await loadEsportsChampions();
}

async function refreshPipelineStatus() {
  const data = await fetchJson("/api/pipeline/status");
  const ddragon = data.ddragon?.status || "idle";
  const esports = data.esports?.status || "idle";
  const oracle = data.oracle?.status || "idle";
  const lolapi = data.lolapi?.status || "idle";
  $("#update-ddragon-status").textContent = `Status: ${ddragon}`;
  $("#update-esports-status").textContent = `Esports: ${esports} | Oracle: ${oracle} | LoLAPI: ${lolapi}`;
}

async function runPipeline(task, riotId) {
  await postJson("/api/pipeline/run", { task, riot_id: riotId });
  await refreshPipelineStatus();
}

function renderChips(container, items, selected, onChange) {
  clear(container);
  items.forEach((item) => {
    const chip = document.createElement("div");
    chip.className = "chip" + (selected.includes(item) ? " active" : "");
    chip.textContent = item;
    chip.addEventListener("click", () => {
      if (selected.includes(item)) {
        selected.splice(selected.indexOf(item), 1);
        chip.classList.remove("active");
      } else {
        selected.push(item);
        chip.classList.add("active");
      }
      if (onChange) onChange(selected);
    });
    container.appendChild(chip);
  });
}

function esportsQuery() {
  return {
    years: state.esports.selectedYears.join(","),
    leagues: state.esports.selectedLeagues.join(","),
  };
}

function getActiveChips(container) {
  return Array.from(container.querySelectorAll(".chip.active")).map((chip) => chip.textContent);
}

async function loadEsportsOverview() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/overview?${buildQuery(query)}`);
  const records = data.records || [];
  const byLeague = {};
  records.forEach((rec) => {
    const item = byLeague[rec.league] || { matches: 0, avgGamelength: 0, count: 0 };
    item.matches += rec.matches;
    item.avgGamelength += rec.avgGamelength;
    item.count += 1;
    byLeague[rec.league] = item;
  });
  const entries = Object.entries(byLeague).map(([league, info]) => ({
    league,
    matches: info.matches,
    avgLength: info.avgGamelength / Math.max(1, info.count),
  }));
  entries.sort((a, b) => b.matches - a.matches);
  const top = entries.slice(0, 12);
  const rest = entries.slice(12);
  if (rest.length) {
    top.push({
      league: "Other",
      matches: rest.reduce((sum, item) => sum + item.matches, 0),
      avgLength: rest.reduce((sum, item) => sum + item.avgLength, 0) / rest.length,
    });
  }
  const bars = top.map((entry) => ({ label: entry.league, value: entry.matches }));
  const lengths = top.map((entry) => ({ label: entry.league, value: entry.avgLength }));
  renderBar($("#esports-league-bar"), bars, { xLabel: "Matches" });
  renderBar($("#esports-length-bar"), lengths, {
    xLabel: "Avg Length (min)",
    format: (v) => `${formatNumber(v / 60, 1)}m`,
  });
  renderPie(
    $("#esports-league-pie"),
    bars.map((entry, idx) => ({
      label: entry.label,
      value: entry.value,
      color: palette[idx % palette.length],
    })),
    { legendContainer: $("#esports-league-legend") }
  );
  const byYear = {};
  records.forEach((record) => {
    const key = record.year;
    byYear[key] = (byYear[key] || 0) + record.matches;
  });
  const trend = Object.entries(byYear)
    .map(([year, matches]) => ({ x: Number(year), y: matches }))
    .sort((a, b) => a.x - b.x);
  renderLine($("#esports-year-line"), trend, { xLabel: "Year", yLabel: "Matches" });
}

async function loadEsportsTeams() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/teams?${buildQuery(query)}`);
  const items = data.items || [];
  const ranges = {
    avgDpm: calcRange(items.map((team) => team.avgDpm)),
    avgEarnedGpm: calcRange(items.map((team) => team.avgEarnedGpm)),
    avgVision: calcRange(items.map((team) => team.avgVision)),
    avgDamageShare: calcRange(items.map((team) => team.avgDamageShare)),
    avgKda: calcRange(items.map((team) => team.avgKda)),
  };
  state.esports.teamRanges = ranges;
  renderBar(
    $("#teams-bar"),
    items.slice(0, 10).map((team) => ({
      label: team.teamname,
      value: team.winRate * 100,
    })),
    { xLabel: "Win Rate (%)", format: (v) => `${formatNumber(v, 1)}%` }
  );
  renderScatter(
    $("#teams-scatter"),
    items.slice(0, 40).map((team) => ({
      x: team.avgEarnedGpm,
      y: team.avgDpm,
      size: team.winRate * 100,
      color: "#64d2c4",
      label: `${team.teamname} | GPM ${formatNumber(team.avgEarnedGpm, 0)} | DPM ${formatNumber(team.avgDpm, 0)}`,
    })),
    { xLabel: "Earned GPM", yLabel: "DPM" }
  );
  const radarSelect = $("#team-radar-select");
  radarSelect.innerHTML = "";
  items.slice(0, 20).forEach((team) => {
    const option = document.createElement("option");
    option.value = team.teamname;
    option.textContent = team.teamname;
    radarSelect.appendChild(option);
  });
  if (items.length) {
    radarSelect.value = items[0].teamname;
    renderTeamRadar(items[0], ranges);
  }
  radarSelect.onchange = () => {
    const selected = items.find((team) => team.teamname === radarSelect.value);
    if (selected) renderTeamRadar(selected, ranges);
  };
  renderTable(
    $("#teams-table"),
    [
      { label: "Team", key: "teamname" },
      { label: "Matches", key: "matches" },
      { label: "WinRate", key: "winRate", render: (v) => `${formatNumber(v * 100, 1)}%` },
      { label: "DPM", key: "avgDpm", render: (v) => formatNumber(v, 0) },
      { label: "Earned GPM", key: "avgEarnedGpm", render: (v) => formatNumber(v, 0) },
    ],
    items.slice(0, 30)
  );
}

async function loadEsportsPlayers() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/players?${buildQuery(query)}`);
  const items = data.items || [];
  renderBar(
    $("#players-bar"),
    items.slice(0, 10).map((player) => ({
      label: player.playername,
      value: player.avgKda,
    })),
    { xLabel: "Average KDA" }
  );
  const positionBox = data.positionBox || [];
  renderPositionBox(positionBox);
  renderScatter(
    $("#players-scatter"),
    items.slice(0, 50).map((player) => ({
      x: player.avgDpm,
      y: player.avgKda,
      size: player.winRate * 100,
      color: "#f08f5f",
      label: `${player.playername} | DPM ${formatNumber(player.avgDpm, 0)} | KDA ${formatNumber(player.avgKda, 2)}`,
    })),
    { xLabel: "DPM", yLabel: "KDA" }
  );
  renderTable(
    $("#players-table"),
    [
      { label: "Player", key: "playername" },
      { label: "Pos", key: "position" },
      { label: "Matches", key: "matches" },
      { label: "KDA", key: "avgKda", render: (v) => formatNumber(v, 2) },
      { label: "DPM", key: "avgDpm", render: (v) => formatNumber(v, 0) },
    ],
    items.slice(0, 30)
  );
}

function renderTeamRadar(team, ranges) {
  const scale = (value, range) => {
    if (!range || range.max === range.min) return 0;
    return (value - range.min) / (range.max - range.min);
  };
  const metrics = [
    {
      label: "DPM",
      value: scale(team.avgDpm, ranges.avgDpm),
      display: formatNumber(team.avgDpm, 0),
      raw: team.avgDpm,
    },
    {
      label: "GPM",
      value: scale(team.avgEarnedGpm, ranges.avgEarnedGpm),
      display: formatNumber(team.avgEarnedGpm, 0),
      raw: team.avgEarnedGpm,
    },
    {
      label: "Vision",
      value: scale(team.avgVision, ranges.avgVision),
      display: formatNumber(team.avgVision, 0),
      raw: team.avgVision,
    },
    {
      label: "Damage%",
      value: scale(team.avgDamageShare, ranges.avgDamageShare),
      display: formatNumber(team.avgDamageShare * 100, 1),
      raw: team.avgDamageShare * 100,
    },
    {
      label: "KDA",
      value: scale(team.avgKda, ranges.avgKda),
      display: formatNumber(team.avgKda, 2),
      raw: team.avgKda,
    },
  ];
  renderRadar(
    $("#team-radar"),
    metrics.map((item) => ({ label: item.label, value: item.value, display: item.display }))
  );
  const legend = document.createElement("div");
  legend.className = "legend";
  metrics.forEach((metric) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const label = document.createElement("span");
    label.textContent = `${metric.label}: ${formatNumber(metric.raw, 2)}`;
    item.appendChild(label);
    legend.appendChild(item);
  });
  const container = $("#team-radar");
  container.appendChild(legend);
}

function calcRange(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return { min: 0, max: 0 };
  return { min: Math.min(...filtered), max: Math.max(...filtered) };
}

function renderPositionBox(positionBox) {
  const metric = $("#position-metric").value;
  const filtered = positionBox.filter((entry) => entry.metric === metric);
  const rows = filtered.map((entry) => ({
    label: entry.position.toUpperCase(),
    p10: entry.p10,
    q1: entry.q1,
    median: entry.median,
    q3: entry.q3,
    p90: entry.p90,
  }));
  renderBoxPlot($("#positions-box"), rows, { xLabel: metric.toUpperCase() });
}

async function loadEsportsChampions() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/champions?${buildQuery(query)}`);
  renderBar(
    $("#champions-pick-bar"),
    (data.picks || []).slice(0, 10).map((item) => ({
      label: item.champion,
      value: item.picks,
    })),
    { xLabel: "Pick Count" }
  );
  renderBar(
    $("#champions-ban-bar"),
    (data.bans || []).slice(0, 10).map((item) => ({
      label: item.champion,
      value: item.bans,
    })),
    { xLabel: "Ban Count" }
  );
  const heatmap = await fetchJson(`/api/esports/bp-heatmap?${buildQuery(query)}`);
  renderHeatmap($("#bp-heatmap"), heatmap);
  const sankey = await fetchJson(`/api/esports/bp-sankey?${buildQuery(query)}`);
  renderSankey($("#bp-sankey"), sankey);
}

async function loadChampionTrend() {
  const champion = $("#champion-trend-input").value.trim();
  if (!champion) return;
  const query = esportsQuery();
  const data = await fetchJson(
    `/api/esports/champion-trend?${buildQuery({ champion, years: query.years, leagues: query.leagues })}`
  );
  const points = (data.items || []).map((entry) => ({ x: entry.year, y: entry.picks }));
  renderLine($("#champion-trend-line"), points, {
    color: "#64d2c4",
    xLabel: "Year",
    yLabel: "Pick Count",
  });
}

function bindEvents() {
  setupTabs("[data-tabs='main']", ".module");
  setupTabs("[data-tabs='game']", ".sub-panel");
  setupTabs("[data-tabs='player']", ".sub-panel");
  setupTabs("[data-tabs='esports']", ".sub-panel");

  $("#champion-tag").addEventListener("change", renderChampionScatter);
  $("#item-stat").addEventListener("change", renderItemScatter);
  $("#player-select").addEventListener("change", async (event) => {
    state.selectedPlayer = event.target.value;
    await refreshPlayer();
  });
  $("#player-refresh").addEventListener("click", refreshPlayer);
  $("#update-ddragon").addEventListener("click", () => runPipeline("ddragon"));
  $("#update-esports").addEventListener("click", () => runPipeline("esports"));
  $("#update-oracle").addEventListener("click", () => runPipeline("oracle"));
  $("#riot-id-run").addEventListener("click", async () => {
    const riotId = $("#riot-id-input").value.trim();
    if (!riotId) return;
    await runPipeline("lolapi", riotId);
    await loadPlayers();
  });
  $("#mastery-top").addEventListener("change", refreshPlayer);
  $("#match-metric").addEventListener("change", refreshPlayer);
  $("#match-limit").addEventListener("change", refreshPlayer);
  $("#position-metric").addEventListener("change", loadEsportsPlayers);
  $("#esports-apply").addEventListener("click", async () => {
    state.esports.selectedYears = getActiveChips($("#esports-years"));
    state.esports.selectedLeagues = getActiveChips($("#esports-leagues"));
    await loadEsportsOverview();
    await loadEsportsTeams();
    await loadEsportsPlayers();
    await loadEsportsChampions();
  });
  $("#champion-trend-btn").addEventListener("click", loadChampionTrend);
}

async function init() {
  bindEvents();
  setStatus("Loading game data...");
  await loadDdragonMeta();
  setStatus("Loading player data...");
  await loadPlayers();
  setStatus("Loading esports data...");
  await loadEsportsMeta();
  await refreshPipelineStatus();
  setInterval(refreshPipelineStatus, 5000);
  setStatus("Ready");
}

init().catch((err) => {
  setStatus(`Error: ${err.message}`);
});
