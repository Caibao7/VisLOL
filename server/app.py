from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .data_access import (
    AppPaths,
    get_config,
    get_paths,
    list_ddragon_versions,
    list_lolapi_players,
    list_match_ids,
    list_oracle_leagues,
    list_oracle_years,
    load_champion_map,
    load_champions,
    load_items,
    load_lolapi_state,
    load_player_challenges,
    load_player_mastery,
    load_player_matches,
    load_player_profile,
    oracle_champion_stats,
    oracle_champion_trend,
    oracle_match_details,
    oracle_overview,
    oracle_player_stats,
    oracle_team_stats,
    read_ddragon_realms,
    resolve_ddragon_version,
)

app = FastAPI(title="VisLOL")

paths = get_paths()
config = get_config()

DASHBOARD_DIR = Path(__file__).resolve().parent.parent / "dashboard"
app.mount("/static", StaticFiles(directory=DASHBOARD_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(DASHBOARD_DIR / "index.html")


def _parse_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item for item in value.split(",") if item]


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/ddragon/meta")
def ddragon_meta(version: Optional[str] = None):
    resolved = resolve_ddragon_version(paths, config, version)
    versions = list_ddragon_versions(paths)
    realms = read_ddragon_realms(paths, config, resolved) if resolved else {}
    return {
        "versions": versions,
        "selectedVersion": resolved,
        "realms": realms,
    }


@app.get("/api/ddragon/champions")
def ddragon_champions(version: Optional[str] = None):
    resolved = resolve_ddragon_version(paths, config, version)
    if not resolved:
        return {"items": []}
    return {"items": load_champions(paths, config, resolved)}


@app.get("/api/ddragon/items")
def ddragon_items(version: Optional[str] = None):
    resolved = resolve_ddragon_version(paths, config, version)
    if not resolved:
        return {"items": []}
    return {"items": load_items(paths, config, resolved)}


@app.get("/api/lolapi/state")
def lolapi_state():
    return load_lolapi_state(paths)


@app.get("/api/lolapi/players")
def lolapi_players():
    return {"players": list_lolapi_players(paths)}


@app.get("/api/lolapi/player/{puuid}/profile")
def lolapi_profile(puuid: str):
    return load_player_profile(paths, puuid)


@app.get("/api/lolapi/player/{puuid}/mastery")
def lolapi_mastery(puuid: str, top: int = Query(20, ge=1, le=200), version: Optional[str] = None):
    resolved = resolve_ddragon_version(paths, config, version)
    champ_map = load_champion_map(paths, config, resolved) if resolved else {}
    mastery = load_player_mastery(paths, puuid)
    mastery.sort(key=lambda m: m.get("championPoints", 0), reverse=True)
    items = []
    for entry in mastery[:top]:
        champ_id = str(entry.get("championId"))
        items.append({
            "championId": champ_id,
            "championName": champ_map.get(champ_id, "Unknown"),
            "championLevel": entry.get("championLevel"),
            "championPoints": entry.get("championPoints"),
            "lastPlayTime": entry.get("lastPlayTime"),
        })
    return {"items": items}


@app.get("/api/lolapi/player/{puuid}/challenges")
def lolapi_challenges(puuid: str):
    return load_player_challenges(paths, puuid)


@app.get("/api/lolapi/player/{puuid}/matches")
def lolapi_matches(puuid: str, limit: int = Query(20, ge=1, le=200)):
    return {"items": load_player_matches(paths, puuid, limit=limit)}


@app.get("/api/esports/meta")
def esports_meta():
    years = list_oracle_years(paths)
    leagues = list_oracle_leagues(paths, years[-1:]) if years else []
    return {
        "years": years,
        "leagues": leagues,
        "availableMatches": len(list_match_ids(paths)),
    }


@app.get("/api/esports/overview")
def esports_overview(years: Optional[str] = None, leagues: Optional[str] = None):
    selected_years = _parse_list(years) or list_oracle_years(paths)[-1:]
    selected_leagues = _parse_list(leagues)
    try:
        return oracle_overview(paths, selected_years, selected_leagues)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/esports/teams")
def esports_teams(years: Optional[str] = None, leagues: Optional[str] = None, limit: int = Query(20, ge=1, le=200)):
    selected_years = _parse_list(years) or list_oracle_years(paths)[-1:]
    selected_leagues = _parse_list(leagues)
    try:
        rows = oracle_team_stats(paths, selected_years, selected_leagues)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"items": rows[:limit]}


@app.get("/api/esports/players")
def esports_players(
    years: Optional[str] = None,
    leagues: Optional[str] = None,
    positions: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
):
    selected_years = _parse_list(years) or list_oracle_years(paths)[-1:]
    selected_leagues = _parse_list(leagues)
    selected_positions = _parse_list(positions)
    try:
        result = oracle_player_stats(paths, selected_years, selected_leagues, selected_positions)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "items": result["players"][:limit],
        "positionBox": result["positionBox"],
    }


@app.get("/api/esports/champions")
def esports_champions(years: Optional[str] = None, leagues: Optional[str] = None, limit: int = Query(20, ge=1, le=200)):
    selected_years = _parse_list(years) or list_oracle_years(paths)[-1:]
    selected_leagues = _parse_list(leagues)
    try:
        stats = oracle_champion_stats(paths, selected_years, selected_leagues)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {
        "picks": stats["picks"][:limit],
        "bans": stats["bans"][:limit],
    }


@app.get("/api/esports/champion-trend")
def esports_champion_trend(champion: str, years: Optional[str] = None, leagues: Optional[str] = None):
    selected_years = _parse_list(years) or list_oracle_years(paths)
    selected_leagues = _parse_list(leagues)
    try:
        trend = oracle_champion_trend(paths, selected_years, selected_leagues, champion)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"items": trend}


@app.get("/api/esports/match/{game_id}")
def esports_match(game_id: str, year: Optional[str] = None):
    try:
        details = oracle_match_details(paths, game_id, year)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    if not details:
        raise HTTPException(status_code=404, detail="match not found")
    return details
