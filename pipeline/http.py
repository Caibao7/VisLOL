import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


class HttpError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body}")
        self.status = status
        self.body = body


def _build_url(url: str, params: Optional[Dict[str, Any]]) -> str:
    if not params:
        return url
    query = urllib.parse.urlencode(params)
    joiner = "&" if "?" in url else "?"
    return f"{url}{joiner}{query}"


def http_get_json(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    timeout: int = 20,
    max_retries: int = 3,
    retry_backoff: float = 2.0,
) -> Any:
    full_url = _build_url(url, params)
    req = urllib.request.Request(full_url, headers=headers or {})

    for attempt in range(max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                if resp.status >= 400:
                    raise HttpError(resp.status, body)
                return json.loads(body)
        except urllib.error.HTTPError as e:
            status = getattr(e, "code", 0)
            body = e.read().decode("utf-8") if e.fp else ""
            if status == 429:
                retry_after = e.headers.get("Retry-After")
                sleep_s = int(retry_after) if retry_after and retry_after.isdigit() else 1
                time.sleep(sleep_s)
                continue
            if 500 <= status < 600 and attempt < max_retries:
                time.sleep(retry_backoff ** attempt)
                continue
            raise HttpError(status, body) from e
        except (TimeoutError, socket.timeout, urllib.error.URLError):
            if attempt < max_retries:
                time.sleep(retry_backoff ** attempt)
                continue
            raise
