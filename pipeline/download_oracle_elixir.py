from .oracle_elixir import download_oracle_elixir_full


if __name__ == "__main__":
    saved = download_oracle_elixir_full("data/raw/oracle_elixir", keep_tmp=False)
    print(f"Saved {len(saved)} files")
