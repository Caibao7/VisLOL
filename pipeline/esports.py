import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from .config import env_or_default
from .http import http_get_json
from .storage import ensure_dir, read_json, update_state, write_json


def _esports_headers() -> Dict[str, str]:
    token = env_or_default("ESPORTS_API_KEY", "")
    if not token:
        raise RuntimeError("ESPORTS_API_KEY is not set")
    return {"x-api-key": token}


def _gw_url(path: str) -> str:
    return f"https://esports-api.lolesports.com/persisted/gw/{path}"


def fetch_leagues(hl: str, timeout: int = 40) -> Dict:
    url = _gw_url("getLeagues")
    return http_get_json(url, headers=_esports_headers(), params={"hl": hl}, timeout=timeout)


def fetch_schedule(hl: str, league_id: str, timeout: int = 40) -> Dict:
    url = _gw_url("getSchedule")
    return http_get_json(url, headers=_esports_headers(), params={"hl": hl, "leagueId": league_id}, timeout=timeout)


def fetch_event_details(hl: str, event_id: str, timeout: int = 40) -> Dict:
    url = _gw_url("getEventDetails")
    return http_get_json(url, headers=_esports_headers(), params={"hl": hl, "id": event_id}, timeout=timeout)


def _resolve_league_ids(leagues_data: Dict, league_ids: List[str], league_slugs: List[str]) -> List[str]:
    if league_ids:
        return league_ids
    leagues = leagues_data.get("data", {}).get("leagues", [])
    if league_slugs:
        slug_map = {league.get("slug"): league.get("id") for league in leagues}
        return [slug_map[slug] for slug in league_slugs if slug in slug_map]
    return [league.get("id") for league in leagues if league.get("id")]


def _parse_start_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def update_esports(config: Dict, data_dir: str, meta_dir: str) -> List[str]:
    hl = config["esports"].get("hl", "en-US")
    league_ids = config["esports"].get("leagues", [])
    league_slugs = config["esports"].get("league_slugs", [])
    progress = bool(config["esports"].get("progress", True))
    recent_days = config["esports"].get("recent_days")
    flush_every = int(config["esports"].get("state_flush_every", 50))
    timeout_s = int(config["esports"].get("timeout_s", 40))
    log_path = f"{data_dir}/logs/esports.log"
    ensure_dir(f"{data_dir}/logs")

    def log(message: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

    state_path = f"{meta_dir}/esports_state.json"
    state = read_json(state_path, {})
    seen_event_ids: Set[str] = set(state.get("seen_event_ids", []))
    seen_game_ids: Set[str] = set(state.get("seen_game_ids", []))

    leagues = fetch_leagues(hl, timeout=timeout_s)
    write_json(f"{data_dir}/raw/esports_gw/leagues/leagues.json", leagues)
    league_ids = _resolve_league_ids(leagues, league_ids, league_slugs)

    event_ids: List[str] = []
    cutoff = None
    if isinstance(recent_days, (int, float)) and recent_days > 0:
        cutoff = datetime.now(tz=timezone.utc).timestamp() - (float(recent_days) * 86400.0)
    for league_id in league_ids:
        try:
            schedule = fetch_schedule(hl, league_id, timeout=timeout_s)
        except Exception as exc:
            log(f"schedule failed league_id={league_id} err={type(exc).__name__}")
            continue
        write_json(f"{data_dir}/raw/esports_gw/schedules/{league_id}.json", schedule)
        events = schedule.get("data", {}).get("schedule", {}).get("events", [])
        for event in events:
            start_time = _parse_start_time(event.get("startTime"))
            if cutoff and start_time and start_time.timestamp() < cutoff:
                continue
            event_id = event.get("id") or event.get("match", {}).get("id")
            if event_id:
                event_ids.append(str(event_id))

    new_game_ids: List[str] = []
    games_meta: Dict[str, Dict[str, str]] = {}
    unique_event_ids = []
    for eid in dict.fromkeys(event_ids):
        event_path = f"{data_dir}/raw/esports_gw/events/{eid}.json"
        if eid in seen_event_ids and os.path.exists(event_path):
            continue
        unique_event_ids.append(eid)
    total = len(unique_event_ids)
    for idx, event_id in enumerate(unique_event_ids, start=1):
        if progress:
            print(f"\rFetching events {idx}/{total}", end="" if idx < total else "\n")
        try:
            details = fetch_event_details(hl, event_id, timeout=timeout_s)
        except Exception as exc:
            log(f"event failed event_id={event_id} err={type(exc).__name__}")
            continue
        write_json(f"{data_dir}/raw/esports_gw/events/{event_id}.json", details)
        seen_event_ids.add(event_id)

        event = details.get("data", {}).get("event", {})
        league_slug = event.get("league", {}).get("slug", "unknown")
        games = event.get("match", {}).get("games", [])
        for game in games:
            game_id = game.get("id") or game.get("gameId")
            state = game.get("state")
            if state not in ("completed", "inProgress"):
                continue
            if game_id and str(game_id) not in seen_game_ids:
                new_game_ids.append(str(game_id))
                seen_game_ids.add(str(game_id))
            if game_id:
                games_meta[str(game_id)] = {
                    "gameId": str(game_id),
                    "eventId": str(event_id),
                    "leagueSlug": league_slug,
                    "state": state or "",
                }
        if flush_every > 0 and idx % flush_every == 0:
            update_state(state_path, {
                "seen_event_ids": sorted(seen_event_ids),
                "seen_game_ids": sorted(seen_game_ids),
                "last_schedule_time": int(time.time()),
            })

    if games_meta:
        write_json(f"{meta_dir}/esports_games.json", list(games_meta.values()))

    update_state(state_path, {
        "seen_event_ids": sorted(seen_event_ids),
        "seen_game_ids": sorted(seen_game_ids),
        "last_schedule_time": int(time.time()),
    })

    return new_game_ids
