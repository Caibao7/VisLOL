from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from pipeline.config import load_config, DEFAULT_CONFIG


@dataclass
class AppPaths:
    data_dir: Path
    meta_dir: Path


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_paths() -> AppPaths:
    data_dir = Path(os.environ.get("VISLOL_DATA_DIR", "data")).resolve()
    meta_dir = Path(os.environ.get("VISLOL_META_DIR", "data/meta")).resolve()
    return AppPaths(data_dir=data_dir, meta_dir=meta_dir)


def get_config() -> Dict[str, Any]:
    cfg_path = os.environ.get("VISLOL_CONFIG", "config.json")
    try:
        return load_config(cfg_path)
    except Exception:
        return DEFAULT_CONFIG.copy()


def _parse_version(version: str) -> Tuple:
    parts = []
    for part in version.split("."):
        if part.isdigit():
            parts.append(int(part))
        else:
            parts.append(part)
    return tuple(parts)


def list_ddragon_versions(paths: AppPaths) -> List[str]:
    root = paths.data_dir / "raw" / "ddragon"
    if not root.exists():
        return []
    versions = [p.name for p in root.iterdir() if p.is_dir()]
    versions.sort(key=_parse_version, reverse=True)
    return versions


def resolve_ddragon_version(paths: AppPaths, config: Dict[str, Any], requested: Optional[str]) -> Optional[str]:
    versions = list_ddragon_versions(paths)
    if requested and requested in versions:
        return requested
    state = _read_json(paths.meta_dir / "ddragon_state.json", {})
    last_version = state.get("last_version_downloaded")
    if last_version in versions:
        return last_version
    if versions:
        return versions[0]
    return None


def get_ddragon_locale_region(config: Dict[str, Any]) -> Tuple[str, str]:
    ddragon_cfg = config.get("ddragon", {})
    region = ddragon_cfg.get("region", "na")
    locale = ddragon_cfg.get("locale", "en_US")
    return region, locale


def read_ddragon_realms(paths: AppPaths, config: Dict[str, Any], version: str) -> Dict[str, Any]:
    region, locale = get_ddragon_locale_region(config)
    realms_path = paths.data_dir / "raw" / "ddragon" / version / locale / f"realms_{region}.json"
    return _read_json(realms_path, {})


def _load_ddragon_json(paths: AppPaths, config: Dict[str, Any], version: str, name: str) -> Dict[str, Any]:
    _, locale = get_ddragon_locale_region(config)
    path = paths.data_dir / "raw" / "ddragon" / version / locale / name
    return _read_json(path, {})


def load_champions(paths: AppPaths, config: Dict[str, Any], version: str) -> List[Dict[str, Any]]:
    raw = _load_ddragon_json(paths, config, version, "champion.json")
    champions = []
    for champ in raw.get("data", {}).values():
        stats = champ.get("stats", {})
        champions.append({
            "id": champ.get("id"),
            "key": champ.get("key"),
            "name": champ.get("name"),
            "title": champ.get("title"),
            "tags": champ.get("tags", []),
            "blurb": champ.get("blurb"),
            "stats": {
                "attackdamage": stats.get("attackdamage"),
                "hp": stats.get("hp"),
                "movespeed": stats.get("movespeed"),
                "armor": stats.get("armor"),
                "spellblock": stats.get("spellblock"),
                "attackdamageperlevel": stats.get("attackdamageperlevel"),
                "hpperlevel": stats.get("hpperlevel"),
                "armorperlevel": stats.get("armorperlevel"),
                "spellblockperlevel": stats.get("spellblockperlevel"),
            },
        })
    return champions


def load_champion_map(paths: AppPaths, config: Dict[str, Any], version: str) -> Dict[str, str]:
    raw = _load_ddragon_json(paths, config, version, "champion.json")
    mapping = {}
    for champ in raw.get("data", {}).values():
        if champ.get("key"):
            mapping[str(champ["key"])] = champ.get("name", "")
    return mapping


def load_items(paths: AppPaths, config: Dict[str, Any], version: str) -> List[Dict[str, Any]]:
    raw = _load_ddragon_json(paths, config, version, "item.json")
    items = []
    for item_id, item in raw.get("data", {}).items():
        stats = item.get("stats", {})
        items.append({
            "id": item_id,
            "name": item.get("name"),
            "gold": item.get("gold", {}),
            "tags": item.get("tags", []),
            "from": item.get("from", []),
            "into": item.get("into", []),
            "stats": stats,
            "simpleStats": {
                "attackDamage": stats.get("FlatPhysicalDamageMod", 0),
                "abilityPower": stats.get("FlatMagicDamageMod", 0),
                "armor": stats.get("FlatArmorMod", 0),
                "magicResist": stats.get("FlatSpellBlockMod", 0),
                "health": stats.get("FlatHPPoolMod", 0),
                "attackSpeed": stats.get("PercentAttackSpeedMod", 0),
                "movementSpeed": stats.get("FlatMovementSpeedMod", 0) + stats.get("PercentMovementSpeedMod", 0),
            },
        })
    return items


def list_lolapi_players(paths: AppPaths) -> List[Dict[str, Any]]:
    players_dir = paths.data_dir / "raw" / "lolapi" / "players"
    if not players_dir.exists():
        return []
    players = []
    for entry in players_dir.iterdir():
        if not entry.is_dir():
            continue
        account = _read_json(entry / "account.json", {})
        summoner = _read_json(entry / "summoner.json", {})
        players.append({
            "puuid": account.get("puuid", entry.name),
            "gameName": account.get("gameName"),
            "tagLine": account.get("tagLine"),
            "summonerName": summoner.get("name"),
            "summonerLevel": summoner.get("summonerLevel"),
            "profileIconId": summoner.get("profileIconId"),
        })
    players.sort(key=lambda p: (p.get("gameName") or "", p.get("tagLine") or ""))
    return players


def load_player_profile(paths: AppPaths, puuid: str) -> Dict[str, Any]:
    base = paths.data_dir / "raw" / "lolapi" / "players" / puuid
    account = _read_json(base / "account.json", {})
    summoner = _read_json(base / "summoner.json", {})
    ranked = _read_json(base / "ranked.json", None)
    return {
        "account": account,
        "summoner": summoner,
        "ranked": ranked,
    }


def load_player_mastery(paths: AppPaths, puuid: str) -> List[Dict[str, Any]]:
    base = paths.data_dir / "raw" / "lolapi" / "players" / puuid
    mastery = _read_json(base / "mastery.json", [])
    return mastery if isinstance(mastery, list) else []


def load_player_challenges(paths: AppPaths, puuid: str) -> Dict[str, Any]:
    base = paths.data_dir / "raw" / "lolapi" / "players" / puuid
    challenges = _read_json(base / "challenges.json", {})
    return challenges if isinstance(challenges, dict) else {}


def load_lolapi_state(paths: AppPaths) -> Dict[str, Any]:
    return _read_json(paths.meta_dir / "lolapi_state.json", {})


def _match_files(paths: AppPaths) -> Tuple[List[Path], List[Path]]:
    match_dir = paths.data_dir / "raw" / "lolapi" / "matches"
    match_files = []
    timeline_files = []
    if not match_dir.exists():
        return match_files, timeline_files
    for region_dir in match_dir.iterdir():
        if not region_dir.is_dir():
            continue
        for file in region_dir.glob("*.json"):
            if file.name.endswith("_timeline.json"):
                continue
            match_files.append(file)
        timeline_dir = region_dir / "timeline"
        if timeline_dir.exists():
            timeline_files.extend(timeline_dir.glob("*.json"))
    return match_files, timeline_files


def list_match_ids(paths: AppPaths) -> List[str]:
    match_files, timeline_files = _match_files(paths)
    ids = set()
    for file in match_files:
        ids.add(file.stem)
    for file in timeline_files:
        ids.add(file.stem)
    return sorted(ids)


def _timeline_summary(puuid: str, timeline: Dict[str, Any]) -> Dict[str, Any]:
    participants = timeline.get("metadata", {}).get("participants", [])
    participant_id = None
    if puuid in participants:
        participant_id = participants.index(puuid) + 1
    kills = deaths = assists = 0
    duration_ms = 0
    for frame in timeline.get("info", {}).get("frames", []):
        duration_ms = max(duration_ms, int(frame.get("timestamp", 0)))
        for event in frame.get("events", []):
            if event.get("type") != "CHAMPION_KILL":
                continue
            if participant_id and event.get("killerId") == participant_id:
                kills += 1
            if participant_id and event.get("victimId") == participant_id:
                deaths += 1
            if participant_id and participant_id in event.get("assistingParticipantIds", []):
                assists += 1
    return {
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "durationMs": duration_ms,
        "participantId": participant_id,
    }


def load_player_matches(paths: AppPaths, puuid: str, limit: int = 20) -> List[Dict[str, Any]]:
    match_files, timeline_files = _match_files(paths)
    match_by_id = {file.stem: file for file in match_files}
    timeline_by_id = {file.stem: file for file in timeline_files}
    match_ids = sorted(set(match_by_id) | set(timeline_by_id), reverse=True)
    matches = []
    for match_id in match_ids[:limit]:
        match_path = match_by_id.get(match_id)
        timeline_path = timeline_by_id.get(match_id)
        summary: Dict[str, Any] = {
            "matchId": match_id,
            "hasMatch": bool(match_path),
            "hasTimeline": bool(timeline_path),
            "source": "match" if match_path else "timeline",
        }
        if match_path and match_path.exists():
            match = _read_json(match_path, {})
            for participant in match.get("info", {}).get("participants", []):
                if participant.get("puuid") != puuid:
                    continue
                summary.update({
                    "championName": participant.get("championName"),
                    "kills": participant.get("kills"),
                    "deaths": participant.get("deaths"),
                    "assists": participant.get("assists"),
                    "teamPosition": participant.get("teamPosition"),
                    "win": participant.get("win"),
                    "gameDuration": match.get("info", {}).get("gameDuration"),
                    "queueId": match.get("info", {}).get("queueId"),
                })
                break
            if summary.get("gameDuration") is not None:
                summary["durationMs"] = int(summary["gameDuration"] * 1000)
        if (not match_path) and timeline_path and timeline_path.exists():
            timeline = _read_json(timeline_path, {})
            summary.update(_timeline_summary(puuid, timeline))
        matches.append(summary)
    return matches


def list_oracle_years(paths: AppPaths) -> List[str]:
    oracle_dir = paths.data_dir / "raw" / "oracle_elixir"
    if not oracle_dir.exists():
        return []
    years = []
    for file in oracle_dir.glob("*_LoL_esports_match_data_from_OraclesElixir.csv"):
        match = re.match(r"(\d{4})_LoL_esports_match_data_from_OraclesElixir\.csv", file.name)
        if match:
            years.append(match.group(1))
    return sorted(years)


def _oracle_path(paths: AppPaths, year: str) -> Optional[Path]:
    oracle_dir = paths.data_dir / "raw" / "oracle_elixir"
    if not oracle_dir.exists():
        return None
    file = oracle_dir / f"{year}_LoL_esports_match_data_from_OraclesElixir.csv"
    return file if file.exists() else None


@lru_cache(maxsize=6)
def _load_oracle_df(paths_key: str, year: str, columns: Tuple[str, ...]):
    try:
        import pandas as pd  # type: ignore
    except Exception as exc:
        raise RuntimeError("pandas is required to read Oracle CSV files") from exc
    path = Path(paths_key)
    df = pd.read_csv(path, usecols=list(columns), low_memory=False)
    return df


def _read_oracle(paths: AppPaths, year: str, columns: Sequence[str]):
    path = _oracle_path(paths, year)
    if not path:
        return None
    df = _load_oracle_df(str(path), year, tuple(columns))
    return df.copy()


def list_oracle_leagues(paths: AppPaths, years: Sequence[str]) -> List[str]:
    leagues = set()
    for year in years:
        df = _read_oracle(paths, year, ["league"])
        if df is None:
            continue
        leagues.update([l for l in df["league"].dropna().unique().tolist()])
    return sorted(leagues)


def _to_numeric(series, default=0.0):
    return series.apply(lambda x: default if x in ("", None) else x).astype(float)


def oracle_overview(paths: AppPaths, years: Sequence[str], leagues: Sequence[str]) -> Dict[str, Any]:
    records = []
    box = []
    for year in years:
        df = _read_oracle(paths, year, ["league", "year", "split", "gamelength", "kills", "gameid", "position"])
        if df is None:
            continue
        df = df[df["position"] == "team"]
        if leagues:
            df = df[df["league"].isin(leagues)]
        if df.empty:
            continue
        df["gamelength"] = _to_numeric(df["gamelength"], 0)
        df["kills"] = _to_numeric(df["kills"], 0)
        for league in df["league"].dropna().unique().tolist():
            league_df = df[df["league"] == league]
            game_count = league_df["gameid"].nunique()
            avg_length = league_df["gamelength"].mean()
            total_kills = league_df.groupby("gameid")["kills"].sum()
            avg_kills = total_kills.mean()
            records.append({
                "league": league,
                "year": int(year),
                "matches": int(game_count),
                "avgGamelength": float(avg_length) if avg_length == avg_length else 0,
                "avgTotalKills": float(avg_kills) if avg_kills == avg_kills else 0,
            })
        for league in df["league"].dropna().unique().tolist():
            league_df = df[df["league"] == league]
            if league_df.empty:
                continue
            stats = league_df["gamelength"].quantile([0, 0.25, 0.5, 0.75, 1.0]).tolist()
            box.append({
                "league": league,
                "year": int(year),
                "min": float(stats[0]),
                "q1": float(stats[1]),
                "median": float(stats[2]),
                "q3": float(stats[3]),
                "max": float(stats[4]),
            })
    return {
        "records": records,
        "boxplot": box,
    }


def oracle_team_stats(paths: AppPaths, years: Sequence[str], leagues: Sequence[str]) -> List[Dict[str, Any]]:
    team_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for year in years:
        df = _read_oracle(paths, year, [
            "league", "year", "teamname", "teamid", "result", "gamelength",
            "earned gpm", "dpm", "visionscore", "damageshare", "kills", "deaths", "assists",
            "position"
        ])
        if df is None:
            continue
        df = df[df["position"] == "team"]
        if leagues:
            df = df[df["league"].isin(leagues)]
        if df.empty:
            continue
        for col in ["result", "earned gpm", "dpm", "visionscore", "damageshare", "kills", "deaths", "assists"]:
            df[col] = _to_numeric(df[col], 0)
        df["kda"] = (df["kills"] + df["assists"]) / df["deaths"].replace(0, 1)
        grouped = df.groupby(["teamname", "teamid"])
        for (teamname, teamid), group in grouped:
            matches = group.shape[0]
            wins = group["result"].sum()
            key = (teamname, teamid)
            bucket = team_map.setdefault(key, {
                "teamname": teamname,
                "teamid": teamid,
                "matches": 0,
                "wins": 0,
                "sumDpm": 0.0,
                "sumEarnedGpm": 0.0,
                "sumVision": 0.0,
                "sumDamageShare": 0.0,
                "sumKda": 0.0,
            })
            bucket["matches"] += int(matches)
            bucket["wins"] += int(wins)
            bucket["sumDpm"] += float(group["dpm"].mean()) * matches
            bucket["sumEarnedGpm"] += float(group["earned gpm"].mean()) * matches
            bucket["sumVision"] += float(group["visionscore"].mean()) * matches
            bucket["sumDamageShare"] += float(group["damageshare"].mean()) * matches
            bucket["sumKda"] += float(group["kda"].mean()) * matches
    rows = []
    for bucket in team_map.values():
        matches = bucket["matches"]
        wins = bucket["wins"]
        rows.append({
            "teamname": bucket["teamname"],
            "teamid": bucket["teamid"],
            "matches": matches,
            "wins": wins,
            "losses": matches - wins,
            "winRate": float(wins / matches) if matches else 0,
            "avgDpm": float(bucket["sumDpm"] / matches) if matches else 0,
            "avgEarnedGpm": float(bucket["sumEarnedGpm"] / matches) if matches else 0,
            "avgVision": float(bucket["sumVision"] / matches) if matches else 0,
            "avgDamageShare": float(bucket["sumDamageShare"] / matches) if matches else 0,
            "avgKda": float(bucket["sumKda"] / matches) if matches else 0,
        })
    rows.sort(key=lambda r: (r["winRate"], r["matches"]), reverse=True)
    return rows


def oracle_player_stats(paths: AppPaths, years: Sequence[str], leagues: Sequence[str], positions: Sequence[str]) -> Dict[str, Any]:
    player_map: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    position_box = []
    for year in years:
        df = _read_oracle(paths, year, [
            "league", "year", "playername", "playerid", "position", "result",
            "dpm", "visionscore", "earned gpm", "kills", "deaths", "assists", "teamkills"
        ])
        if df is None:
            continue
        df = df[df["position"] != "team"]
        if leagues:
            df = df[df["league"].isin(leagues)]
        if positions:
            df = df[df["position"].isin(positions)]
        if df.empty:
            continue
        for col in ["result", "dpm", "visionscore", "earned gpm", "kills", "deaths", "assists", "teamkills"]:
            df[col] = _to_numeric(df[col], 0)
        df["kda"] = (df["kills"] + df["assists"]) / df["deaths"].replace(0, 1)
        df["kp"] = (df["kills"] + df["assists"]) / df["teamkills"].replace(0, 1)
        grouped = df.groupby(["playername", "playerid", "position"])
        for (playername, playerid, position), group in grouped:
            matches = group.shape[0]
            wins = group["result"].sum()
            key = (playername, playerid, position)
            bucket = player_map.setdefault(key, {
                "playername": playername,
                "playerid": playerid,
                "position": position,
                "matches": 0,
                "wins": 0,
                "sumDpm": 0.0,
                "sumEarnedGpm": 0.0,
                "sumVision": 0.0,
                "sumKda": 0.0,
                "sumKp": 0.0,
            })
            bucket["matches"] += int(matches)
            bucket["wins"] += int(wins)
            bucket["sumDpm"] += float(group["dpm"].mean()) * matches
            bucket["sumEarnedGpm"] += float(group["earned gpm"].mean()) * matches
            bucket["sumVision"] += float(group["visionscore"].mean()) * matches
            bucket["sumKda"] += float(group["kda"].mean()) * matches
            bucket["sumKp"] += float(group["kp"].mean()) * matches
        for pos in df["position"].dropna().unique().tolist():
            pos_df = df[df["position"] == pos]
            for metric in ["dpm", "earned gpm", "kp"]:
                quantiles = pos_df[metric].quantile([0.1, 0.25, 0.5, 0.75, 0.9]).tolist()
                position_box.append({
                    "position": pos,
                    "metric": metric,
                    "p10": float(quantiles[0]),
                    "q1": float(quantiles[1]),
                    "median": float(quantiles[2]),
                    "q3": float(quantiles[3]),
                    "p90": float(quantiles[4]),
                })
    players = []
    for bucket in player_map.values():
        matches = bucket["matches"]
        wins = bucket["wins"]
        players.append({
            "playername": bucket["playername"],
            "playerid": bucket["playerid"],
            "position": bucket["position"],
            "matches": matches,
            "wins": wins,
            "winRate": float(wins / matches) if matches else 0,
            "avgDpm": float(bucket["sumDpm"] / matches) if matches else 0,
            "avgEarnedGpm": float(bucket["sumEarnedGpm"] / matches) if matches else 0,
            "avgVision": float(bucket["sumVision"] / matches) if matches else 0,
            "avgKda": float(bucket["sumKda"] / matches) if matches else 0,
            "avgKp": float(bucket["sumKp"] / matches) if matches else 0,
        })
    players.sort(key=lambda r: (r["avgKda"], r["matches"]), reverse=True)
    return {
        "players": players,
        "positionBox": position_box,
    }


def oracle_champion_stats(paths: AppPaths, years: Sequence[str], leagues: Sequence[str]) -> Dict[str, Any]:
    pick_map: Dict[str, Dict[str, Any]] = {}
    ban_map: Dict[str, int] = {}
    for year in years:
        df = _read_oracle(paths, year, ["league", "year", "split", "champion", "result", "side", "position"])
        if df is None:
            continue
        df = df[df["position"] != "team"]
        if leagues:
            df = df[df["league"].isin(leagues)]
        if df.empty:
            continue
        df["result"] = _to_numeric(df["result"], 0)
        grouped = df.groupby("champion")
        for champ, group in grouped:
            bucket = pick_map.setdefault(champ, {
                "champion": champ,
                "picks": 0,
                "wins": 0,
                "bluePicks": 0,
                "redPicks": 0,
            })
            bucket["picks"] += int(group.shape[0])
            bucket["wins"] += int(group["result"].sum())
            bucket["bluePicks"] += int(group[group["side"] == "Blue"].shape[0])
            bucket["redPicks"] += int(group[group["side"] == "Red"].shape[0])
        ban_df = _read_oracle(paths, year, ["league", "year", "split", "position", "ban1", "ban2", "ban3", "ban4", "ban5"])
        if ban_df is None:
            continue
        ban_df = ban_df[ban_df["position"] == "team"]
        if leagues:
            ban_df = ban_df[ban_df["league"].isin(leagues)]
        if ban_df.empty:
            continue
        ban_series = ban_df[["ban1", "ban2", "ban3", "ban4", "ban5"]].stack().dropna()
        ban_counts = ban_series.value_counts()
        for champ, count in ban_counts.items():
            ban_map[champ] = ban_map.get(champ, 0) + int(count)
    picks = []
    for champ, bucket in pick_map.items():
        picks.append({
            "champion": champ,
            "picks": bucket["picks"],
            "wins": bucket["wins"],
            "winRate": float(bucket["wins"] / bucket["picks"]) if bucket["picks"] else 0,
            "bluePicks": bucket["bluePicks"],
            "redPicks": bucket["redPicks"],
        })
    bans = [{"champion": champ, "bans": count} for champ, count in ban_map.items()]
    picks.sort(key=lambda r: r["picks"], reverse=True)
    bans.sort(key=lambda r: r["bans"], reverse=True)
    return {"picks": picks, "bans": bans}


def oracle_champion_trend(paths: AppPaths, years: Sequence[str], leagues: Sequence[str], champion: str) -> List[Dict[str, Any]]:
    trend = []
    for year in years:
        df = _read_oracle(paths, year, ["league", "year", "champion", "position"])
        if df is None:
            continue
        df = df[df["position"] != "team"]
        if leagues:
            df = df[df["league"].isin(leagues)]
        if champion:
            df = df[df["champion"] == champion]
        count = int(df.shape[0])
        trend.append({"year": int(year), "picks": count})
    return trend


def oracle_match_details(paths: AppPaths, game_id: str, year: Optional[str] = None) -> Dict[str, Any]:
    years = [year] if year else list_oracle_years(paths)
    for y in years:
        df = _read_oracle(paths, y, [
            "gameid", "league", "year", "split", "date", "patch", "side", "position",
            "teamname", "playername", "playerid", "champion", "result",
            "kills", "deaths", "assists", "damagetochampions", "totalgold",
            "ban1", "ban2", "ban3", "ban4", "ban5"
        ])
        if df is None:
            continue
        game_df = df[df["gameid"] == game_id]
        if game_df.empty:
            continue
        summary = {
            "gameid": game_id,
            "league": game_df["league"].iloc[0],
            "year": int(game_df["year"].iloc[0]) if str(game_df["year"].iloc[0]).isdigit() else game_df["year"].iloc[0],
            "split": game_df["split"].iloc[0],
            "date": game_df["date"].iloc[0],
            "patch": game_df["patch"].iloc[0],
        }
        teams = game_df[game_df["position"] == "team"]
        bans = []
        for _, row in teams.iterrows():
            bans.append({
                "teamname": row.get("teamname"),
                "side": row.get("side"),
                "result": row.get("result"),
                "bans": [row.get("ban1"), row.get("ban2"), row.get("ban3"), row.get("ban4"), row.get("ban5")],
            })
        players = []
        for _, row in game_df[game_df["position"] != "team"].iterrows():
            players.append({
                "teamname": row.get("teamname"),
                "side": row.get("side"),
                "playername": row.get("playername"),
                "playerid": row.get("playerid"),
                "champion": row.get("champion"),
                "result": row.get("result"),
                "kills": row.get("kills"),
                "deaths": row.get("deaths"),
                "assists": row.get("assists"),
                "damagetochampions": row.get("damagetochampions"),
                "totalgold": row.get("totalgold"),
            })
        return {
            "summary": summary,
            "bans": bans,
            "players": players,
        }
    return {}
