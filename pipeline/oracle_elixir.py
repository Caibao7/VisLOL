import shutil
import time
from pathlib import Path
from typing import Dict, List

from .storage import update_state, write_json

FOLDER_ID = "1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH"


def _require_gdown():
    try:
        import gdown  # type: ignore
    except Exception as exc:
        raise RuntimeError("gdown is required. Install with: pip install gdown") from exc
    return gdown


def _list_csvs(root: Path) -> List[Path]:
    return list(root.rglob("*.csv"))


def download_oracle_elixir_full(out_dir: str, keep_tmp: bool) -> List[Path]:
    gdown = _require_gdown()

    out_path = Path(out_dir).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    tmp_dir = out_path.parent / "_tmp_oracle_elixir"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    url = f"https://drive.google.com/drive/folders/{FOLDER_ID}"
    gdown.download_folder(url=url, output=str(tmp_dir), quiet=False, use_cookies=False)

    if out_path.exists():
        shutil.rmtree(out_path)
    out_path.mkdir(parents=True, exist_ok=True)

    for item in tmp_dir.iterdir():
        target = out_path / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)

    saved = _list_csvs(out_path)

    if not keep_tmp:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return saved


def update_oracle_elixir(config: Dict, data_dir: str, meta_dir: str) -> None:
    oracle_cfg = config.get("oracle_elixir", {})
    keep_tmp = bool(oracle_cfg.get("keep_tmp", False))
    out_dir = oracle_cfg.get("out_dir") or f"{data_dir}/raw/oracle_elixir"

    saved = download_oracle_elixir_full(out_dir, keep_tmp)
    update_state(
        f"{meta_dir}/oracle_elixir_state.json",
        {
            "last_run_time": int(time.time()),
            "files": [str(p) for p in saved],
        },
    )
    write_json(
        f"{meta_dir}/oracle_elixir_latest.json",
        {"files": [str(p) for p in saved]},
    )

