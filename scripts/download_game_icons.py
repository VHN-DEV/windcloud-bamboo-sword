#!/usr/bin/env python3
"""Download all icons from allsvgicons game-icons pack into images/game-icon.

Usage:
  python scripts/download_game_icons.py
"""

from __future__ import annotations

import re
import ssl
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

PACK_URL = "https://allsvgicons.com/pack/game-icons/"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

DESTINATIONS = [
    Path("public/assets/images/game-icon"),
    Path("src/assets/images/game-icon"),
]


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urlopen(req, context=ctx, timeout=45) as response:
        return response.read().decode("utf-8", "ignore")


def fetch_bytes(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urlopen(req, context=ctx, timeout=45) as response:
        return response.read()


def extract_svg_urls(html: str) -> list[str]:
    raw_urls = set(re.findall(r'https?://[^"\'\s>]+\.svg(?:\?[^"\'\s>]*)?', html, flags=re.IGNORECASE))
    raw_urls.update(re.findall(r'[/\w.-]+\.svg(?:\?[^"\'\s>]*)?', html, flags=re.IGNORECASE))

    cleaned: set[str] = set()
    for item in raw_urls:
        absolute = urljoin(PACK_URL, item)
        parsed = urlparse(absolute)
        if parsed.scheme in {"http", "https"}:
            cleaned.add(parsed._replace(query="", fragment="").geturl())
    return sorted(cleaned)


def sanitize_name(url: str) -> str:
    name = Path(urlparse(url).path).name
    if not name.lower().endswith(".svg"):
        name = f"{name}.svg"
    return name


def save_to_all_destinations(name: str, content: bytes) -> None:
    for dest in DESTINATIONS:
        dest.mkdir(parents=True, exist_ok=True)
        (dest / name).write_bytes(content)


def main() -> int:
    try:
        html = fetch_text(PACK_URL)
    except (HTTPError, URLError, TimeoutError) as err:
        print(f"❌ Cannot access pack page: {err}")
        return 1

    urls = extract_svg_urls(html)
    if not urls:
        print("❌ No SVG URLs found on pack page.")
        return 1

    downloaded = 0
    skipped = 0

    for url in urls:
        name = sanitize_name(url)
        try:
            content = fetch_bytes(url)
        except (HTTPError, URLError, TimeoutError):
            skipped += 1
            continue

        # Basic guard: keep only svg-like payloads.
        if b"<svg" not in content[:2048] and b"<svg" not in content:
            skipped += 1
            continue

        save_to_all_destinations(name, content)
        downloaded += 1

    print(f"✅ Downloaded: {downloaded}")
    print(f"⚠️ Skipped: {skipped}")
    print("📁 Saved into:")
    for dest in DESTINATIONS:
        print(f" - {dest}")

    return 0 if downloaded else 1


if __name__ == "__main__":
    sys.exit(main())
