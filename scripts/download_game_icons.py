#!/usr/bin/env python3
"""Download icons from a pack page into one or many local folders.

By default this targets:
- URL: https://allsvgicons.com/pack/game-icons/
- Extensions: .svg
- Output folders: public/assets/images/game-icon, src/assets/images/game-icon
"""

from __future__ import annotations

import re
import ssl
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

DEFAULT_PACK_URL = "https://allsvgicons.com/pack/game-icons/"
DEFAULT_EXTENSIONS = [".svg"]
DEFAULT_OUTPUTS = [
    "public/assets/images/game-icon",
    "src/assets/images/game-icon",
]
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)


def prompt_with_default(label: str, default: str) -> str:
    value = input(f"{label} [{default}]: ").strip()
    return value or default


def parse_extensions(raw: str) -> list[str]:
    tokens = [item.strip().lower() for item in re.split(r"[,\s]+", raw) if item.strip()]
    normalized: list[str] = []
    for token in tokens:
        ext = token if token.startswith(".") else f".{token}"
        if ext not in normalized:
            normalized.append(ext)
    return normalized or DEFAULT_EXTENSIONS


def parse_output_dirs(raw: str) -> list[Path]:
    items = [item.strip() for item in raw.split(",") if item.strip()]
    if not items:
        items = DEFAULT_OUTPUTS
    return [Path(item) for item in items]


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


def make_asset_pattern(extensions: list[str]) -> re.Pattern[str]:
    ext_part = "|".join(re.escape(ext[1:]) for ext in extensions)
    return re.compile(
        rf'https?://[^"\'\s>]+\.(?:{ext_part})(?:\?[^"\'\s>]*)?'
        rf'|[/\w% .-]+\.(?:{ext_part})(?:\?[^"\'\s>]*)?',
        flags=re.IGNORECASE,
    )


def extract_asset_urls(html: str, page_url: str, extensions: list[str]) -> list[str]:
    pattern = make_asset_pattern(extensions)
    raw_urls = set(pattern.findall(html))

    cleaned: set[str] = set()
    for item in raw_urls:
        absolute = urljoin(page_url, item)
        parsed = urlparse(absolute)
        ext = Path(parsed.path).suffix.lower()
        if parsed.scheme in {"http", "https"} and ext in extensions:
            cleaned.add(parsed._replace(query="", fragment="").geturl())
    return sorted(cleaned)


def sanitize_name(url: str, fallback_ext: str) -> str:
    path = Path(urlparse(url).path)
    name = path.name or f"icon{fallback_ext}"
    if path.suffix:
        return name
    return f"{name}{fallback_ext}"


def save_to_destinations(destinations: list[Path], name: str, content: bytes) -> None:
    for dest in destinations:
        dest.mkdir(parents=True, exist_ok=True)
        (dest / name).write_bytes(content)


def main() -> int:
    print("=== Download Icons Utility ===")
    pack_url = prompt_with_default("Nhập đường dẫn trang pack", DEFAULT_PACK_URL)
    extensions_raw = prompt_with_default("Nhập đuôi ảnh cần tải (nhiều đuôi: .svg,.png)", ",".join(DEFAULT_EXTENSIONS))
    outputs_raw = prompt_with_default(
        "Nhập thư mục lưu icon (nhiều thư mục ngăn cách dấu phẩy)",
        ",".join(DEFAULT_OUTPUTS),
    )

    extensions = parse_extensions(extensions_raw)
    destinations = parse_output_dirs(outputs_raw)

    print(f"URL: {pack_url}")
    print(f"Đuôi file: {', '.join(extensions)}")
    print("Thư mục lưu:")
    for dest in destinations:
        print(f" - {dest}")

    try:
        html = fetch_text(pack_url)
    except (HTTPError, URLError, TimeoutError) as err:
        print(f"❌ Không truy cập được trang pack: {err}")
        return 1

    urls = extract_asset_urls(html, pack_url, extensions)
    if not urls:
        print("❌ Không tìm thấy URL ảnh phù hợp trên trang.")
        return 1

    downloaded = 0
    skipped = 0

    for url in urls:
        file_name = sanitize_name(url, extensions[0])
        try:
            content = fetch_bytes(url)
        except (HTTPError, URLError, TimeoutError):
            skipped += 1
            continue

        # If SVG was requested, verify SVG signature.
        if ".svg" in extensions and file_name.lower().endswith(".svg"):
            if b"<svg" not in content[:4096] and b"<svg" not in content:
                skipped += 1
                continue

        save_to_destinations(destinations, file_name, content)
        downloaded += 1

    print(f"✅ Đã tải: {downloaded}")
    print(f"⚠️ Bỏ qua: {skipped}")
    return 0 if downloaded else 1


if __name__ == "__main__":
    sys.exit(main())
