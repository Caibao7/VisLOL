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
  const width = 460;
  const height = 260;
  const padding = 32;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xScale = scaleLinear(minX, maxX, padding, width - padding);
  const yScale = scaleLinear(minY, maxY, height - padding, padding);
  const svg = createSvg(width, height);

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
  const width = 460;
  const height = 260;
  const padding = 30;
  const maxValue = Math.max(...data.map((d) => d.value));
  const xScale = scaleLinear(0, maxValue, padding, width - padding);
  const barHeight = (height - padding * 2) / data.length;
  const svg = createSvg(width, height);

  data.forEach((d, idx) => {
    const y = padding + idx * barHeight;
    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", padding);
    bar.setAttribute("y", y + 4);
    bar.setAttribute("width", xScale(d.value) - padding);
    bar.setAttribute("height", Math.max(6, barHeight - 8));
    bar.setAttribute("fill", d.color || palette[idx % palette.length]);
    bar.setAttribute("rx", "6");
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", padding - 6);
    label.setAttribute("y", y + barHeight / 2 + 4);
    label.setAttribute("fill", "#e8edf5");
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "end");
    label.textContent = d.label;

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
  const width = 460;
  const height = 260;
  const padding = 32;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xScale = scaleLinear(minX, maxX, padding, width - padding);
  const yScale = scaleLinear(minY, maxY, height - padding, padding);
  const svg = createSvg(width, height);

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

  points.forEach((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", xScale(point.x));
    circle.setAttribute("cy", yScale(point.y));
    circle.setAttribute("r", "3");
    circle.setAttribute("fill", options.color || "#64d2c4");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${point.x}: ${formatNumber(point.y, 2)}`;
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

function renderRadar(container, metrics) {
  clear(container);
  if (!metrics.length) {
    container.textContent = "No data.";
    return;
  }
  const width = 300;
  const height = 260;
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

  container.appendChild(svg);
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
      color: palette[idx % palette.length],
      label: `${champ.name} (${champ.tags.join(", ")})`,
      data: champ,
    }));
  renderScatter($("#champion-scatter"), points, {
    onSelect: (point) => updateChampionDetail(point.data),
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
  const metric = $("#champion-growth-metric").value;
  const base = champ.stats[metric] || 0;
  const perLevel = champ.stats[`${metric}perlevel`] || 0;
  const points = [];
  for (let level = 1; level <= 18; level += 1) {
    points.push({ x: level, y: base + (level - 1) * perLevel });
  }
  renderLine($("#champion-growth"), points, { color: "#f08f5f" });
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
  const points = items.map((item, idx) => ({
    x: item.gold?.total || 0,
    y: item.simpleStats[metric] || 0,
    size: item.gold?.total || 0,
    color: palette[idx % palette.length],
    label: `${item.name} (${formatNumber(item.simpleStats[metric], 2)})`,
    data: item,
  }));
  renderScatter($("#item-scatter"), points, {
    onSelect: (point) => updateItemDetail(point.data),
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
  renderBar($("#mastery-bar"), bars.slice(0, 12));
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
  renderLine($("#match-line"), points, { color: "#f2c14e" });
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

function renderChips(container, items, selected) {
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
    });
    container.appendChild(chip);
  });
}

function esportsQuery() {
  const years = state.esports.selectedYears.join(",");
  const leagues = state.esports.selectedLeagues.join(",");
  return { years, leagues };
}

async function loadEsportsOverview() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/overview?years=${query.years}&leagues=${query.leagues}`);
  const records = data.records || [];
  const byLeague = {};
  records.forEach((rec) => {
    const item = byLeague[rec.league] || { matches: 0, avgGamelength: 0, count: 0 };
    item.matches += rec.matches;
    item.avgGamelength += rec.avgGamelength;
    item.count += 1;
    byLeague[rec.league] = item;
  });
  const bars = Object.entries(byLeague).map(([league, info]) => ({
    label: league,
    value: info.matches,
  }));
  const lengths = Object.entries(byLeague).map(([league, info]) => ({
    label: league,
    value: info.avgGamelength / Math.max(1, info.count),
  }));
  renderBar($("#esports-league-bar"), bars);
  renderBar($("#esports-length-bar"), lengths, { format: (v) => `${formatNumber(v / 60, 1)}m` });
}

async function loadEsportsTeams() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/teams?years=${query.years}&leagues=${query.leagues}`);
  const items = data.items || [];
  renderBar(
    $("#teams-bar"),
    items.slice(0, 10).map((team) => ({
      label: team.teamname,
      value: team.winRate * 100,
    })),
    { format: (v) => `${formatNumber(v, 1)}%` }
  );
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
  const data = await fetchJson(`/api/esports/players?years=${query.years}&leagues=${query.leagues}`);
  const items = data.items || [];
  renderBar(
    $("#players-bar"),
    items.slice(0, 10).map((player) => ({
      label: player.playername,
      value: player.avgKda,
    }))
  );
  const positionBox = data.positionBox || [];
  const positionMap = {};
  positionBox.forEach((entry) => {
    if (entry.metric !== "dpm") return;
    positionMap[entry.position] = entry.median;
  });
  renderBar(
    $("#positions-bar"),
    Object.entries(positionMap).map(([pos, value]) => ({ label: pos.toUpperCase(), value })),
    { format: (v) => formatNumber(v, 0) }
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

async function loadEsportsChampions() {
  const query = esportsQuery();
  const data = await fetchJson(`/api/esports/champions?years=${query.years}&leagues=${query.leagues}`);
  renderBar(
    $("#champions-pick-bar"),
    (data.picks || []).slice(0, 10).map((item) => ({
      label: item.champion,
      value: item.picks,
    }))
  );
  renderBar(
    $("#champions-ban-bar"),
    (data.bans || []).slice(0, 10).map((item) => ({
      label: item.champion,
      value: item.bans,
    }))
  );
}

async function loadChampionTrend() {
  const champion = $("#champion-trend-input").value.trim();
  if (!champion) return;
  const query = esportsQuery();
  const data = await fetchJson(
    `/api/esports/champion-trend?champion=${encodeURIComponent(champion)}&years=${query.years}&leagues=${query.leagues}`
  );
  const points = (data.items || []).map((entry) => ({ x: entry.year, y: entry.picks }));
  renderLine($("#champion-trend-line"), points, { color: "#64d2c4" });
}

async function loadMatchDetails() {
  const gameId = $("#match-id-input").value.trim();
  const year = $("#match-year-input").value.trim();
  if (!gameId) return;
  const response = await fetch(`/api/esports/match/${gameId}?year=${year}`);
  const container = $("#match-summary");
  if (!response.ok) {
    container.innerHTML = `<div class="placeholder">Match not found.</div>`;
    return;
  }
  const data = await response.json();
  const summary = data.summary || {};
  const players = data.players || [];
  const bans = data.bans || [];
  const banLines = bans
    .map((ban) => `<div>${ban.teamname || "Team"} (${ban.side || "-"}) - ${ban.bans.filter(Boolean).join(", ")}</div>`)
    .join("");
  container.innerHTML = `
    <h3>${summary.league || ""} ${summary.year || ""} ${summary.split || ""}</h3>
    <div class="meta">${summary.date || ""} | Patch ${summary.patch || ""}</div>
    <div class="stats" style="margin-top:12px;">
      <div class="stat-card"><div class="label">Game ID</div><div class="value">${summary.gameid || ""}</div></div>
      <div class="stat-card"><div class="label">Players</div><div class="value">${players.length}</div></div>
    </div>
    <div style="margin-top:16px;">${banLines || "No bans data"}</div>
  `;
}

function bindEvents() {
  setupTabs("[data-tabs='main']", ".module");
  setupTabs("[data-tabs='game']", ".sub-panel");
  setupTabs("[data-tabs='player']", ".sub-panel");
  setupTabs("[data-tabs='esports']", ".sub-panel");

  $("#champion-tag").addEventListener("change", renderChampionScatter);
  $("#champion-growth-metric").addEventListener("change", () => {
    const champName = $("#champion-name").textContent;
    const champ = state.ddragon.champions.find((c) => c.name === champName);
    if (champ) renderChampionGrowth(champ);
  });
  $("#item-stat").addEventListener("change", renderItemScatter);
  $("#player-select").addEventListener("change", async (event) => {
    state.selectedPlayer = event.target.value;
    await refreshPlayer();
  });
  $("#player-refresh").addEventListener("click", refreshPlayer);
  $("#mastery-top").addEventListener("change", refreshPlayer);
  $("#match-metric").addEventListener("change", refreshPlayer);
  $("#match-limit").addEventListener("change", refreshPlayer);
  $("#esports-apply").addEventListener("click", async () => {
    await loadEsportsOverview();
    await loadEsportsTeams();
    await loadEsportsPlayers();
    await loadEsportsChampions();
  });
  $("#champion-trend-btn").addEventListener("click", loadChampionTrend);
  $("#match-load-btn").addEventListener("click", loadMatchDetails);
}

async function init() {
  bindEvents();
  setStatus("Loading game data...");
  await loadDdragonMeta();
  setStatus("Loading player data...");
  await loadPlayers();
  setStatus("Loading esports data...");
  await loadEsportsMeta();
  setStatus("Ready");
}

init().catch((err) => {
  setStatus(`Error: ${err.message}`);
});
