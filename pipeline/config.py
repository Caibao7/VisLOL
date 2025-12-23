import json
import os
from typing import Any, Dict

DEFAULT_CONFIG: Dict[str, Any] = {
    "ddragon": {
        "region": "na",
        "locale": "en_US",
        "runes_path": "runesReforged.json",
    },
    "riot": {
        "platform": "na1",
        "region": "americas",
        "queue": None,
        "seed_summoner_names": [],
        "seed_summoner_ids": [],
        "seed_riot_ids": [],
        "seed_puuids": [],
        "seed_leagues": ["challenger", "grandmaster", "master"],
        "matches_per_seed": 10,
        "request_sleep_s": 0.2,
        "fetch_timeline": False,
        "account_regions": ["americas", "europe", "asia"],
    },
    "esports": {
        "leagues": [],
        "league_slugs": [],
        "hl": "en-US",
        "progress": True,
        "recent_days": 90,
        "state_flush_every": 50,
        "timeout_s": 40,
    },
    "oracle_elixir": {
        "keep_tmp": False,
        "out_dir": None,
    },
}


def load_config(path: str) -> Dict[str, Any]:
    _load_dotenv()
    if not os.path.exists(path):
        return DEFAULT_CONFIG.copy()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    merged = DEFAULT_CONFIG.copy()
    for key, value in data.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value
    return merged


def env_or_default(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _load_dotenv() -> None:
    if os.environ.get("CODEX_SKIP_DOTENV") == "1":
        return
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")  # remove simple quotes
            if key and key not in os.environ:
                os.environ[key] = value
