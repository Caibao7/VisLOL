import time
import urllib.parse
from typing import Dict, List, Set

from .config import env_or_default
from .http import http_get_json
from .storage import read_json, update_state, write_json


def _riot_headers() -> Dict[str, str]:
    token = env_or_default("RIOT_API_KEY", "")
    if not token:
        raise RuntimeError("RIOT_API_KEY is not set")
    return {"X-Riot-Token": token}


def _platform_url(platform: str, path: str) -> str:
    return f"https://{platform}.api.riotgames.com{path}"


def _region_url(region: str, path: str) -> str:
    return f"https://{region}.api.riotgames.com{path}"


def _league_endpoint(league: str) -> str:
    if league == "challenger":
        return "/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"
    if league == "grandmaster":
        return "/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5"
    if league == "master":
        return "/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5"
    raise ValueError(f"Unknown league tier: {league}")


def fetch_seed_summoner_ids(platform: str, leagues: List[str]) -> List[str]:
    headers = _riot_headers()
    summoner_ids: List[str] = []
    for league in leagues:
        url = _platform_url(platform, _league_endpoint(league))
        data = http_get_json(url, headers=headers)
        entries = data.get("entries", [])
        for entry in entries:
            if "summonerId" in entry:
                summoner_ids.append(entry["summonerId"])
    return summoner_ids


def fetch_puuid_by_summoner_id(platform: str, summoner_id: str) -> str:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/summoner/v4/summoners/{summoner_id}")
    data = http_get_json(url, headers=headers)
    return data["puuid"]


def fetch_puuid_by_name(platform: str, summoner_name: str) -> str:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/summoner/v4/summoners/by-name/{summoner_name}")
    data = http_get_json(url, headers=headers)
    return data["puuid"]


def fetch_puuid_by_riot_id(region: str, game_name: str, tag_line: str) -> str:
    headers = _riot_headers()
    game_name = urllib.parse.quote(game_name)
    tag_line = urllib.parse.quote(tag_line)
    url = _region_url(region, f"/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}")
    data = http_get_json(url, headers=headers)
    return data["puuid"]


def fetch_match_ids(region: str, puuid: str, count: int, queue: str = None) -> List[str]:
    headers = _riot_headers()
    params = {"start": 0, "count": count}
    if queue:
        params["queue"] = queue
    url = _region_url(region, f"/lol/match/v5/matches/by-puuid/{puuid}/ids")
    return http_get_json(url, headers=headers, params=params)


def fetch_match(region: str, match_id: str) -> Dict:
    headers = _riot_headers()
    url = _region_url(region, f"/lol/match/v5/matches/{match_id}")
    return http_get_json(url, headers=headers)


def fetch_match_timeline(region: str, match_id: str) -> Dict:
    headers = _riot_headers()
    url = _region_url(region, f"/lol/match/v5/matches/{match_id}/timeline")
    return http_get_json(url, headers=headers)


def update_match_v5(config: Dict, data_dir: str, meta_dir: str) -> None:
    platform = config["riot"].get("platform", "na1")
    region = config["riot"].get("region", "americas")
    queue = config["riot"].get("queue")
    leagues = config["riot"].get("seed_leagues", [])
    seed_names = config["riot"].get("seed_summoner_names", [])
    seed_riot_ids = config["riot"].get("seed_riot_ids", [])
    matches_per_seed = int(config["riot"].get("matches_per_seed", 10))
    sleep_s = float(config["riot"].get("request_sleep_s", 0.2))
    fetch_timeline = bool(config["riot"].get("fetch_timeline", False))

    state_path = f"{meta_dir}/match_v5_state.json"
    state = read_json(state_path, {})
    seen_match_ids: Set[str] = set(state.get("seen_match_ids", []))

    seed_summoner_ids: List[str] = []
    if leagues:
        seed_summoner_ids.extend(fetch_seed_summoner_ids(platform, leagues))
        time.sleep(sleep_s)

    seed_puuids: List[str] = []
    for summoner_id in seed_summoner_ids:
        try:
            seed_puuids.append(fetch_puuid_by_summoner_id(platform, summoner_id))
        except Exception:
            continue
        time.sleep(sleep_s)

    for name in seed_names:
        try:
            seed_puuids.append(fetch_puuid_by_name(platform, name))
        except Exception:
            continue
        time.sleep(sleep_s)

    for riot_id in seed_riot_ids:
        if "#" not in riot_id:
            continue
        game_name, tag_line = riot_id.split("#", 1)
        try:
            seed_puuids.append(fetch_puuid_by_riot_id(region, game_name, tag_line))
        except Exception:
            continue
        time.sleep(sleep_s)

    new_match_ids: List[str] = []
    for puuid in seed_puuids:
        try:
            ids = fetch_match_ids(region, puuid, matches_per_seed, queue=queue)
        except Exception:
            continue
        for match_id in ids:
            if match_id not in seen_match_ids:
                new_match_ids.append(match_id)
        time.sleep(sleep_s)

    for match_id in new_match_ids:
        try:
            data = fetch_match(region, match_id)
        except Exception:
            continue
        out_path = f"{data_dir}/raw/match_v5/{region}/{match_id}.json"
        write_json(out_path, data)
        if fetch_timeline:
            try:
                timeline = fetch_match_timeline(region, match_id)
                timeline_path = f"{data_dir}/raw/match_v5/{region}/{match_id}_timeline.json"
                write_json(timeline_path, timeline)
            except Exception:
                pass
        seen_match_ids.add(match_id)
        time.sleep(sleep_s)

    update_state(state_path, {
        "seen_match_ids": sorted(seen_match_ids),
        "last_run_time": int(time.time()),
        "seed_players": seed_names,
        "seed_riot_ids": seed_riot_ids,
    })
