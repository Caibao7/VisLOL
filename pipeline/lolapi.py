import json
import os
import time
import urllib.parse
from typing import Dict, List, Set

from .config import env_or_default
from .http import HttpError, http_get_json
from .storage import ensure_dir, read_json, update_state, write_json


def _riot_headers() -> Dict[str, str]:
    token = env_or_default("RIOT_API_KEY", "")
    if not token:
        raise RuntimeError("RIOT_API_KEY is not set")
    return {"X-Riot-Token": token}


def _platform_url(platform: str, path: str) -> str:
    return f"https://{platform}.api.riotgames.com{path}"


def _region_url(region: str, path: str) -> str:
    return f"https://{region}.api.riotgames.com{path}"


def fetch_account_by_riot_id(region: str, game_name: str, tag_line: str) -> Dict:
    headers = _riot_headers()
    game_name = urllib.parse.quote(game_name)
    tag_line = urllib.parse.quote(tag_line)
    url = _region_url(region, f"/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}")
    return http_get_json(url, headers=headers)


def fetch_account_by_puuid(region: str, puuid: str) -> Dict:
    headers = _riot_headers()
    url = _region_url(region, f"/riot/account/v1/accounts/by-puuid/{puuid}")
    return http_get_json(url, headers=headers)


def fetch_account_by_riot_id_with_fallback(regions: List[str], game_name: str, tag_line: str) -> Dict:
    last_error = None
    for region in regions:
        try:
            return fetch_account_by_riot_id(region, game_name, tag_line)
        except Exception as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
    raise RuntimeError("No regions provided for account lookup")


def fetch_account_by_puuid_with_fallback(regions: List[str], puuid: str) -> Dict:
    last_error = None
    for region in regions:
        try:
            return fetch_account_by_puuid(region, puuid)
        except Exception as exc:
            last_error = exc
            continue
    if last_error:
        raise last_error
    raise RuntimeError("No regions provided for account lookup")


def fetch_summoner_by_puuid(platform: str, puuid: str) -> Dict:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/summoner/v4/summoners/by-puuid/{puuid}")
    return http_get_json(url, headers=headers)


def fetch_summoner_by_name(platform: str, summoner_name: str) -> Dict:
    headers = _riot_headers()
    summoner_name = urllib.parse.quote(summoner_name)
    url = _platform_url(platform, f"/lol/summoner/v4/summoners/by-name/{summoner_name}")
    return http_get_json(url, headers=headers)


def fetch_ranked_entries(platform: str, summoner_id: str) -> List[Dict]:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/league/v4/entries/by-summoner/{summoner_id}")
    return http_get_json(url, headers=headers)


def fetch_mastery_by_puuid(platform: str, puuid: str) -> List[Dict]:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}")
    return http_get_json(url, headers=headers)


def fetch_challenges_by_puuid(platform: str, puuid: str) -> Dict:
    headers = _riot_headers()
    url = _platform_url(platform, f"/lol/challenges/v1/player-data/{puuid}")
    return http_get_json(url, headers=headers)


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


def update_lolapi(config: Dict, data_dir: str, meta_dir: str) -> None:
    platform = config["riot"].get("platform", "na1")
    region = config["riot"].get("region", "americas")
    queue = config["riot"].get("queue")
    seed_riot_ids = config["riot"].get("seed_riot_ids", [])
    seed_puuids = config["riot"].get("seed_puuids", [])
    seed_summoner_ids = config["riot"].get("seed_summoner_ids", [])
    matches_per_seed = int(config["riot"].get("matches_per_seed", 10))
    sleep_s = float(config["riot"].get("request_sleep_s", 0.2))
    fetch_timeline = bool(config["riot"].get("fetch_timeline", False))
    account_regions = config["riot"].get("account_regions", [region])
    if not isinstance(account_regions, list) or not account_regions:
        account_regions = [region]

    state_path = f"{meta_dir}/lolapi_state.json"
    state = read_json(state_path, {})
    seen_match_ids: Set[str] = set(state.get("seen_match_ids", []))
    seed_summoner_ids.extend(state.get("seed_summoner_ids", []))
    summoner_id_by_puuid: Dict[str, str] = {}
    account_name_by_puuid: Dict[str, str] = {}
    summoner_name_by_puuid: Dict[str, str] = {}
    platform_by_summoner_id: Dict[str, str] = {}
    log_path = f"{data_dir}/logs/lolapi.log"
    ensure_dir(f"{data_dir}/logs")

    def log(message: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")

    resolved_puuids: List[str] = []
    for riot_id in seed_riot_ids:
        if "#" not in riot_id:
            continue
        game_name, tag_line = riot_id.split("#", 1)
        try:
            account = fetch_account_by_riot_id_with_fallback(account_regions, game_name, tag_line)
        except Exception:
            continue
        puuid = account.get("puuid")
        if puuid:
            resolved_puuids.append(puuid)
            write_json(f"{data_dir}/raw/lolapi/players/{puuid}/account.json", account)
            if account.get("gameName"):
                account_name_by_puuid[puuid] = account["gameName"]
        time.sleep(sleep_s)

    for puuid in seed_puuids:
        if puuid not in resolved_puuids:
            resolved_puuids.append(puuid)

    for puuid in resolved_puuids:
        try:
            account = fetch_account_by_puuid_with_fallback(account_regions, puuid)
            write_json(f"{data_dir}/raw/lolapi/players/{puuid}/account.json", account)
            if account.get("gameName"):
                account_name_by_puuid[puuid] = account["gameName"]
        except Exception:
            pass
        time.sleep(sleep_s)

        try:
            summoner = fetch_summoner_by_puuid(platform, puuid)
            write_json(f"{data_dir}/raw/lolapi/players/{puuid}/summoner.json", summoner)
            summoner_id = summoner.get("id")
            if summoner_id:
                seed_summoner_ids.append(summoner_id)
                summoner_id_by_puuid[puuid] = summoner_id
            else:
                log(
                    f"summoner by puuid missing id: puuid={puuid} "
                    f"platform={platform} keys={sorted(list(summoner.keys()))}"
                )
            if summoner.get("name"):
                summoner_name_by_puuid[puuid] = summoner["name"]
        except Exception:
            summoner_id = None
        time.sleep(sleep_s)

        if not summoner_id and puuid in summoner_name_by_puuid:
            try:
                summoner = fetch_summoner_by_name(platform, summoner_name_by_puuid[puuid])
                write_json(f"{data_dir}/raw/lolapi/players/{puuid}/summoner.json", summoner)
                summoner_id = summoner.get("id")
                if summoner_id:
                    seed_summoner_ids.append(summoner_id)
                    summoner_id_by_puuid[puuid] = summoner_id
            except Exception:
                log(f"summoner by name failed: puuid={puuid} name={summoner_name_by_puuid.get(puuid,'')}")
            time.sleep(sleep_s)

        try:
            mastery = fetch_mastery_by_puuid(platform, puuid)
            write_json(f"{data_dir}/raw/lolapi/players/{puuid}/mastery.json", mastery)
        except Exception:
            pass
        time.sleep(sleep_s)

        try:
            challenges = fetch_challenges_by_puuid(platform, puuid)
            write_json(f"{data_dir}/raw/lolapi/players/{puuid}/challenges.json", challenges)
        except Exception:
            pass
        time.sleep(sleep_s)

        try:
            match_ids = fetch_match_ids(region, puuid, matches_per_seed, queue=queue)
        except Exception:
            match_ids = []
        time.sleep(sleep_s)

        match_platform = None
        if match_ids:
            match_platform = match_ids[0].split("_", 1)[0].lower()
        for match_id in match_ids:
            match_path = f"{data_dir}/raw/lolapi/matches/{region}/{match_id}.json"
            if match_id in seen_match_ids and os.path.exists(match_path):
                try:
                    with open(match_path, "r", encoding="utf-8") as f:
                        match = json.load(f)
                    for participant in match.get("info", {}).get("participants", []):
                        if participant.get("puuid") == puuid and participant.get("summonerId"):
                            summoner_id_by_puuid[puuid] = participant["summonerId"]
                            seed_summoner_ids.append(participant["summonerId"])
                            if match_platform:
                                platform_by_summoner_id[participant["summonerId"]] = match_platform
                            break
                except Exception:
                    pass
                continue
            try:
                match = fetch_match(region, match_id)
                write_json(match_path, match)
                if fetch_timeline:
                    timeline = fetch_match_timeline(region, match_id)
                    write_json(
                        f"{data_dir}/raw/lolapi/matches/{region}/timeline/{match_id}.json",
                        timeline,
                    )
                if puuid not in summoner_name_by_puuid:
                    for participant in match.get("info", {}).get("participants", []):
                        if participant.get("puuid") == puuid and participant.get("summonerName"):
                            summoner_name_by_puuid[puuid] = participant["summonerName"]
                            break
                if puuid not in summoner_id_by_puuid:
                    for participant in match.get("info", {}).get("participants", []):
                        if participant.get("puuid") == puuid and participant.get("summonerId"):
                            summoner_id_by_puuid[puuid] = participant["summonerId"]
                            seed_summoner_ids.append(participant["summonerId"])
                            if match_platform:
                                platform_by_summoner_id[participant["summonerId"]] = match_platform
                            break
            except Exception:
                continue
            seen_match_ids.add(match_id)
            time.sleep(sleep_s)

        if not summoner_id and puuid in summoner_name_by_puuid:
            try:
                summoner = fetch_summoner_by_name(platform, summoner_name_by_puuid[puuid])
                write_json(f"{data_dir}/raw/lolapi/players/{puuid}/summoner.json", summoner)
                summoner_id = summoner.get("id")
                if summoner_id:
                    seed_summoner_ids.append(summoner_id)
                    summoner_id_by_puuid[puuid] = summoner_id
            except Exception as exc:
                log(
                    f"summoner by name failed (from match): puuid={puuid} "
                    f"name={summoner_name_by_puuid.get(puuid,'')} err={type(exc).__name__}"
                )
            time.sleep(sleep_s)

    for summoner_id in list(dict.fromkeys(seed_summoner_ids)):
        try:
            ranked_platform = platform_by_summoner_id.get(summoner_id, platform)
            ranked = fetch_ranked_entries(ranked_platform, summoner_id)
            matched_puuid = None
            for puuid, stored_id in summoner_id_by_puuid.items():
                if stored_id == summoner_id:
                    matched_puuid = puuid
                    break
            if matched_puuid:
                write_json(f"{data_dir}/raw/lolapi/players/{matched_puuid}/ranked.json", ranked)
            else:
                write_json(f"{data_dir}/raw/lolapi/ranked/{summoner_id}.json", ranked)
        except HttpError as exc:
            log(
                f"ranked fetch failed summoner_id={summoner_id} "
                f"platform={platform_by_summoner_id.get(summoner_id, platform)} "
                f"status={exc.status} body={exc.body}"
            )
            continue
        except Exception as exc:
            log(f"ranked fetch failed summoner_id={summoner_id} err={type(exc).__name__}")
            continue
        time.sleep(sleep_s)

    update_state(state_path, {
        "seen_match_ids": sorted(seen_match_ids),
        "last_run_time": int(time.time()),
        "seed_riot_ids": seed_riot_ids,
        "seed_puuids": seed_puuids,
        "seed_summoner_ids": list(dict.fromkeys(seed_summoner_ids)),
    })
