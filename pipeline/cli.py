import argparse
import os

from .config import load_config
from .ddragon import update_ddragon
from .esports import update_esports
from .lolapi import update_lolapi
from .match_v5 import update_match_v5
from .oracle_elixir import update_oracle_elixir


def main() -> None:
    parser = argparse.ArgumentParser(description="LoL data update pipeline")
    parser.add_argument("task", choices=["ddragon", "match", "lolapi", "esports", "oracle", "all"])
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--meta-dir", default="data/meta")
    args = parser.parse_args()

    config = load_config(args.config)
    os.makedirs(args.data_dir, exist_ok=True)
    os.makedirs(args.meta_dir, exist_ok=True)

    if args.task in ("ddragon", "all"):
        update_ddragon(config, args.data_dir, args.meta_dir)

    if args.task == "lolapi":
        update_lolapi(config, args.data_dir, args.meta_dir)

    if args.task == "match":
        update_match_v5(config, args.data_dir, args.meta_dir)

    if args.task in ("esports", "all"):
        update_esports(config, args.data_dir, args.meta_dir)

    if args.task == "all":
        update_lolapi(config, args.data_dir, args.meta_dir)

    if args.task == "oracle":
        update_oracle_elixir(config, args.data_dir, args.meta_dir)

    if args.task == "all":
        update_oracle_elixir(config, args.data_dir, args.meta_dir)


if __name__ == "__main__":
    main()
