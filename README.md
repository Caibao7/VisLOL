# VisLOL Dashboard

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Conda

```bash
conda create -n vislol python=3.11 -y
conda activate vislol
pip install -r requirements.txt
```

## Run

```bash
uvicorn server.app:app --reload
```

Then open `http://127.0.0.1:8000/` in your browser.

## Notes

- The dashboard reads local data from `data/` and does not fetch new data.
- If you update data with the pipeline, refresh the browser to see changes.
