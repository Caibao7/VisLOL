import time
from typing import Dict, List, Set

from .http import http_get_json
from .storage import ensure_dir, read_json, update_state, write_json


def _livestats_url(path: str) -> str:
    return f"https://feed.lolesports.com/livestats/v1/{path}"


def fetch_window(game_id: str) -> Dict:
    return http_get_json(_livestats_url(f"window/{game_id}"))


def fetch_details(game_id: str) -> Dict:
    return http_get_json(_livestats_url(f"details/{game_id}"))


def _window_has_data(window: Dict) -> bool:
    frames = window.get("frames", [])
    if not frames:
        return False
    for frame in frames:
        blue = frame.get("blueTeam", {})
        red = frame.get("redTeam", {})
        if blue.get("totalGold", 0) or red.get("totalGold", 0):
            return True
        if blue.get("totalKills", 0) or red.get("totalKills", 0):
            return True
    return False


def _load_games_meta(meta_dir: str) -> List[Dict]:
    path = f"{meta_dir}/esports_games.json"
    data = read_json(path, [])
    return data if isinstance(data, list) else []


def update_livestats(game_ids: List[str], config: Dict, data_dir: str, meta_dir: str) -> None:
    state_path = f"{meta_dir}/livestats_state.json"
    state = read_json(state_path, {})
    downloaded_game_ids: Set[str] = set(state.get("downloaded_game_ids", []))
    skipped_game_ids: Set[str] = set(state.get("skipped_game_ids", []))
    log_path = f"{data_dir}/logs/livestats.log"
    ensure_dir(f"{data_dir}/logs")

    def log(message: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

    league_slugs = config.get("livestats", {}).get("league_slugs")
    progress = bool(config.get("livestats", {}).get("progress", True))
    skip_empty = bool(config.get("livestats", {}).get("skip_empty", True))

    games_meta = _load_games_meta(meta_dir)
    if games_meta:
        if league_slugs:
            games = [g for g in games_meta if g.get("leagueSlug") in league_slugs]
        else:
            games = games_meta
        game_ids = [g.get("gameId") for g in games if g.get("gameId")]

    total = len(game_ids)
    for idx, game_id in enumerate(game_ids, start=1):
        if not game_id:
            continue
        if game_id in downloaded_game_ids or game_id in skipped_game_ids:
            continue
        if progress:
            print(f"\rFetching livestats {idx}/{total}", end="" if idx < total else "\n")
        try:
            window = fetch_window(game_id)
            details = fetch_details(game_id)
        except Exception as exc:
            log(f"livestats fetch failed game_id={game_id} err={type(exc).__name__}")
            continue
        if skip_empty and not _window_has_data(window):
            skipped_game_ids.add(game_id)
            log(f"livestats empty window game_id={game_id}")
            continue
        league = "unknown"
        for g in games_meta:
            if g.get("gameId") == game_id:
                league = g.get("leagueSlug") or "unknown"
                break
        base_dir = f"{data_dir}/raw/livestats/{league}/{game_id}"
        write_json(f"{base_dir}/window.json", window)
        write_json(f"{base_dir}/details.json", details)
        downloaded_game_ids.add(game_id)

    update_state(state_path, {
        "downloaded_game_ids": sorted(downloaded_game_ids),
        "skipped_game_ids": sorted(skipped_game_ids),
        "last_run_time": int(time.time()),
    })

