import time
from typing import Dict, List

from .http import http_get_json
from .storage import write_json, update_state


def _ddragon_base() -> str:
    return "https://ddragon.leagueoflegends.com"


def fetch_versions() -> List[str]:
    url = f"{_ddragon_base()}/api/versions.json"
    return http_get_json(url)


def fetch_realms(region: str) -> Dict:
    url = f"{_ddragon_base()}/realms/{region}.json"
    return http_get_json(url)


def fetch_raw(version: str, locale: str, path: str) -> Dict:
    url = f"{_ddragon_base()}/cdn/{version}/data/{locale}/{path}"
    return http_get_json(url)


def update_ddragon(config: Dict, data_dir: str, meta_dir: str) -> None:
    versions = fetch_versions()
    latest_version = versions[0] if versions else None
    if not latest_version:
        raise RuntimeError("No versions returned from Data Dragon")

    region = config["ddragon"].get("region", "na")
    locale = config["ddragon"].get("locale", "en_US")
    runes_path = config["ddragon"].get("runes_path", "runesReforged.json")

    state_path = f"{meta_dir}/ddragon_state.json"
    state = update_state(state_path, {"last_checked_time": int(time.time())})
    if state.get("last_version_downloaded") == latest_version:
        return

    try:
        realms = fetch_realms(region)
    except Exception:
        realms = {}

    files = [
        "champion.json",
        "item.json",
        "summoner.json",
        runes_path,
    ]

    for name in files:
        raw = fetch_raw(latest_version, locale, name)
        out_path = f"{data_dir}/raw/ddragon/{latest_version}/{locale}/{name}"
        write_json(out_path, raw)

    write_json(f"{data_dir}/raw/ddragon/{latest_version}/{locale}/realms_{region}.json", realms)
    update_state(state_path, {
        "last_version_downloaded": latest_version,
        "last_checked_time": int(time.time()),
    })

