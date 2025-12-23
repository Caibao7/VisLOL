# VisLOL Dashboard Guide (Detailed)

This guide documents the VisLOL dashboard end-to-end: data sources, preprocessing, API contracts, UI tabs, chart logic, and design rationale. It is written for developers and analysts who want to understand or extend the system.

## 0. System Summary

VisLOL is a local-data dashboard for League of Legends. It does not fetch data in the browser; instead, it reads local files in `data/` through a FastAPI backend and exposes JSON APIs. The frontend is a single-page static UI that renders SVG charts.

Key components:
- Backend: `server/app.py`, `server/data_access.py`
- Frontend: `dashboard/index.html`, `dashboard/styles.css`, `dashboard/app.js`
- Data pipelines: `pipeline/*.py`

## 1. Data Sources and Directory Layout

### 1.1 Data Dragon (Game Static Data)

Location:
- `data/raw/ddragon/{version}/{locale}/`

Files used:
- `champion.json`
- `item.json`
- `realms_{region}.json`

Typical fields used:
- Champion: `name`, `title`, `tags`, `stats.*`
- Item: `name`, `gold.total`, `tags`, `from`, `into`, `stats.*`
- Realms: `v` (current version)

### 1.2 Riot LoL API (Player Data)

Location:
- `data/raw/lolapi/players/{puuid}/account.json`
- `data/raw/lolapi/players/{puuid}/summoner.json`
- `data/raw/lolapi/players/{puuid}/mastery.json`
- `data/raw/lolapi/players/{puuid}/challenges.json`
- `data/raw/lolapi/matches/{region}/{matchId}.json` (optional)
- `data/raw/lolapi/matches/{region}/timeline/{matchId}.json`

Typical fields used:
- Account: `gameName`, `tagLine`, `puuid`
- Summoner: `name`, `summonerLevel`, `profileIconId`
- Mastery: `championId`, `championPoints`, `championLevel`
- Challenges: `categoryPoints.*.current`
- Match (if present): `participants[].championName`, `kills`, `deaths`, `assists`, `teamPosition`, `win`
- Timeline: event list for kills/assists/deaths derivation

### 1.3 Oracle's Elixir (Esports Data)

Location:
- `data/raw/oracle_elixir/{year}_LoL_esports_match_data_from_OraclesElixir.csv`

Rows include both team-level rows (`position=team`) and player-level rows (`position != team`).

Key fields used:
- League/season: `league`, `year`, `split`
- Match meta: `gameid`, `gamelength`, `patch`, `date`
- Team stats: `result`, `earned gpm`, `dpm`, `visionscore`, `kills`, `deaths`, `assists`
- Player stats: `playername`, `playerid`, `position`, `dpm`, `earned gpm`, `teamkills`, `kills`, `deaths`, `assists`
- Draft: `champion`, `ban1`..`ban5`
- Damage: `damagetochampions`

### 1.4 LoL Esports GW (Optional)

Location:
- `data/raw/esports_gw/`

The current charts do not rely on this data directly. It is used for schedule and event structure only if needed.

## 2. Backend API and Data Flow

### 2.1 Backend Entry Points

Backend server:
- `server/app.py`

Core logic:
- `server/data_access.py`

### 2.2 API Endpoints

Game Ecosystem:
- `GET /api/ddragon/meta`
  - Returns versions, selectedVersion, realms
- `GET /api/ddragon/champions?version=...`
  - Returns `items` (champion list)
- `GET /api/ddragon/items?version=...`
  - Returns `items` (item list)

Player:
- `GET /api/lolapi/players`
  - Returns known local players
- `GET /api/lolapi/player/{puuid}/profile`
  - Returns account + summoner + ranked (if available)
- `GET /api/lolapi/player/{puuid}/mastery?top=...`
- `GET /api/lolapi/player/{puuid}/challenges`
- `GET /api/lolapi/player/{puuid}/matches?limit=...`

Esports:
- `GET /api/esports/meta`
  - Returns available years and leagues
- `GET /api/esports/overview`
- `GET /api/esports/teams`
- `GET /api/esports/players`
- `GET /api/esports/champions`
- `GET /api/esports/champion-trend`
- `GET /api/esports/bp-heatmap`
- `GET /api/esports/bp-sankey`

Pipeline control:
- `POST /api/pipeline/run` with `{ task, riot_id? }`
- `GET /api/pipeline/status`

### 2.3 Query Filters

Esports endpoints accept:
- `years` (comma-separated)
- `leagues` (comma-separated)

These filters are applied in the backend to the Oracle dataset and propagate to all charts.

### 2.4 Data Cleaning and Derived Metrics

Numeric cleanup:
- All numeric fields are parsed and coerced via `_to_numeric()` to avoid NaN/inf JSON errors.

Derived metrics:
- KDA: `(kills + assists) / max(1, deaths)`
- KP: `(kills + assists) / max(1, teamkills)`
- Team damage share: (see 4.3)

## 3. Frontend Rendering

### 3.1 Rendering Engine

The dashboard uses custom SVG renderers in `dashboard/app.js`:
- Scatter: `renderScatter`
- Bar: `renderBar`
- Line: `renderLine`
- Radar: `renderRadar`
- Pie: `renderPie`
- Box plot: `renderBoxPlot`
- Heatmap: `renderHeatmap`
- Sankey: `renderSankey`

All charts include:
- Axis labels where relevant
- Hover tooltips for scatter charts
- Legends where appropriate

### 3.2 Chart Sizing

Charts are sized from container width with dynamic height. Labels are truncated with tooltips to avoid overflow.

## 4. Game Ecosystem Module

### 4.1 Data Usage

Source files:
- `champion.json` provides champion list and stats
- `item.json` provides item stats and build paths
- `realms_{region}.json` provides the current version

Selected version is set via:
- `data/meta/ddragon_state.json.last_version_downloaded`
- Or the latest local version directory

### 4.2 Tabs and Charts

#### Tab: Patch

Purpose:
- Provide version selection and context for all static data.

UI elements:
- Version list (local versions)
- Current version badge

Why:
- All static data is versioned; this ensures consistent data usage.

#### Tab: Champions

Charts:
1) Champion Scatter
   - X: base attack damage (`stats.attackdamage`)
   - Y: base HP (`stats.hp`)
   - Size: move speed (`stats.movespeed`)
   - Color: champion tag (first role tag)

2) Champion Details
   - Stat cards
   - Growth Delta bar chart (Lv1 -> Lv18)

How it is drawn:
- Each champion is mapped to a point in AD/HP space.
- Colors show role clusters.
- Growth delta shows scaling without implying non-linear patterns.

Why:
- Scatter reveals archetype clusters quickly.
- Growth delta shows scaling potential in a compact form.

#### Tab: Items

Charts:
1) Top Items by Stat Efficiency
   - Metric: selected stat per 1000 gold

2) Item Details
   - Stat cards
   - Build From / Build Into lists

How it is drawn:
- Items filtered by tags.
- Efficiency: `stat / gold.total` scaled by 1000.

Why:
- Overlapping scatter plots are not readable with hundreds of items.
- Ranking makes the comparison clear.

## 5. Player Module

### 5.1 Data Usage

Player data is retrieved via Riot API pipelines and stored locally.

The UI can run the pipeline with a user-entered Riot ID:
- `POST /api/pipeline/run` with `task=lolapi` and `riot_id=Game#Tag`

### 5.2 Tabs and Charts

#### Tab: Profile

Data:
- `account.json`, `summoner.json`, `ranked.json` (optional)

Charts:
- Stat cards for Riot ID, summoner name, level
- Ranked snapshot

Why:
- Quick identity and status overview.

#### Tab: Champion Pool

Data:
- `mastery.json` (sorted by `championPoints`)

Charts:
- Bar chart of top N mastery champions
- Table of mastery stats

Why:
- Highlights primary champions and mastery depth.

#### Tab: Challenges

Data:
- `challenges.json` -> `categoryPoints`

Charts:
- Category radar with labels
- Challenge table

Why:
- Category-level radar summarizes long-term achievements.

#### Tab: Match History

Data:
- Match detail if available
- Timeline events if match detail missing

Charts:
- Line chart of selected metric across recent matches
- Table of match list

How KDA is derived from timeline:
- Kills: `CHAMPION_KILL` events where player is killer
- Deaths: `CHAMPION_KILL` events where player is victim
- Assists: `CHAMPION_KILL` events where player is in assists

Why:
- Trend view shows short-term consistency.

## 6. Esports Module

### 6.1 Filters

Years and leagues are selected via chips. Filters apply to all esports charts.

Internally:
- Selected values are encoded into query params using `buildQuery()`.

### 6.2 Overview Tab

Charts:
1) Matches by League (bar)
2) Average Game Length (bar)
3) Matches Over Time (line)
4) League Share (pie + legend)

Data:
- Uses `position=team` rows from Oracle CSVs.

Why:
- Bars show magnitude comparisons.
- Line shows historical volume trend.
- Pie shows market share composition.

### 6.3 Teams Tab

Charts:
1) Top Teams (bar)
2) Team Style Map (scatter)
   - X: Earned GPM
   - Y: DPM
3) Team Style Radar (normalized)
   - DPM, GPM, Vision, Damage Share, KDA

Derived team damage share:
- For each game:
  - Team damage = sum of player `damagetochampions` for that team
  - Game damage = sum across all players
  - Team share = team damage / game damage

Radar normalization:
- Each metric is normalized using min-max across filtered teams.
- This avoids scale dominance (e.g., DPM vs KDA).

Why:
- Scatter shows style tradeoffs (damage vs resources).
- Radar shows multi-dimensional team identity.

### 6.4 Players Tab

Charts:
1) Top Players (bar) by average KDA
2) Position Distribution (box)
   - Metric: DPM / Earned GPM / KP
3) Player Damage vs KDA (scatter)
   - X: DPM
   - Y: KDA

Box plot:
- Uses precomputed p10, q1, median, q3, p90 per position

Why:
- Box plot is better for positional variance than bar charts.
- Scatter shows the relationship between output and survivability.

### 6.5 Meta & Draft Tab

Charts:
1) Top Picks (bar)
2) Top Bans (bar)
3) BP Heatmap
   - League x Champion counts
4) Position -> Champion Sankey
5) Champion Trend (line)

Heatmap:
- Top champions are selected globally by pick count.
- Each cell is count of picks in that league.
- Height adapts to number of leagues.

Sankey:
- Positions (TOP/JNG/MID/BOT/SUP) -> top champions
- Links weighted by pick counts

Champion trend:
- Plots yearly picks for a user-entered champion

Why:
- Bars show immediate popularity.
- Heatmap highlights regional preferences.
- Sankey shows role-champion affinities.
- Trend shows longitudinal meta changes.

## 7. Pipeline and Update Controls

Pipeline tasks:
- `ddragon`: update Data Dragon
- `lolapi`: update player data (requires Riot ID)
- `esports`: update esports schedule (optional)
- `oracle`: update Oracle CSVs

Frontend controls:
- Buttons in Game and Esports modules
- Riot ID input in Player module

Backend behavior:
- Tasks run in background (non-blocking)
- Status reported via `/api/pipeline/status`

## 8. Known Limits and Notes

- If match detail files are missing, player match stats are derived from timelines.
- Some metrics in Oracle are missing in team rows and must be derived from player rows.
- Esports GW data is not used for charts by default.

## 9. Extension Ideas

If you want to extend the dashboard:
- Add champion detail (spell list) by loading per-champion JSON
- Add per-item scatter with density/heatmap layer
- Add advanced match drill-down if you collect full match data

## 10. File Map

Frontend:
- `dashboard/index.html`
- `dashboard/styles.css`
- `dashboard/app.js`

Backend:
- `server/app.py`
- `server/data_access.py`

Docs:
- `docs/get_data.md`
- `docs/product.md`
- `docs/dashboard_guide.md`
