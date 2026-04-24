#!/usr/bin/env python3
"""Download icons from a pack page into one or many local folders.

By default this targets:
- URL: https://allsvgicons.com/pack/game-icons/
- Extensions: .svg
- Output folders: public/assets/images/game-icon, src/assets/images/game-icon

If the default pack URL is blocked (e.g., HTTP 403), the script automatically
falls back to downloading icons from the official game-icons GitHub repository zip.
"""

from __future__ import annotations

import io
import re
import ssl
import sys
import zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

DEFAULT_PACK_URL = "https://allsvgicons.com/pack/game-icons/"
GITHUB_ZIP_URL = "https://codeload.github.com/game-icons/icons/zip/refs/heads/master"
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


def fetch_bytes(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urlopen(req, context=ctx, timeout=60) as response:
        return response.read()


def fetch_text(url: str) -> str:
    return fetch_bytes(url).decode("utf-8", "ignore")


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
            clean = parsed._replace(query="", fragment="").geturl()
            # keep URL valid with special chars
            if "%" not in clean:
                clean = quote(clean, safe=':/%')
            cleaned.add(clean)
    return sorted(cleaned)


def sanitize_name(url_or_path: str, fallback_ext: str) -> str:
    parsed = urlparse(url_or_path)
    base_path = parsed.path if parsed.scheme else url_or_path
    path = Path(base_path)
    name = path.name or f"icon{fallback_ext}"
    return name if path.suffix else f"{name}{fallback_ext}"


def ensure_unique_name(name: str, seen: dict[str, int]) -> str:
    if name not in seen:
        seen[name] = 1
        return name
    seen[name] += 1
    stem = Path(name).stem
    suffix = Path(name).suffix
    return f"{stem}-{seen[name]}{suffix}"


def save_to_destinations(destinations: list[Path], name: str, content: bytes) -> None:
    for dest in destinations:
        dest.mkdir(parents=True, exist_ok=True)
        (dest / name).write_bytes(content)


def looks_like_svg(content: bytes) -> bool:
    return b"<svg" in content[:4096] or b"<svg" in content


def download_from_page(pack_url: str, extensions: list[str], destinations: list[Path]) -> tuple[int, int]:
    html = fetch_text(pack_url)
    urls = extract_asset_urls(html, pack_url, extensions)
    if not urls:
        raise ValueError("Không tìm thấy URL ảnh phù hợp trên trang.")

    downloaded = 0
    skipped = 0
    seen_names: dict[str, int] = {}

    for url in urls:
        file_name = ensure_unique_name(sanitize_name(url, extensions[0]), seen_names)
        try:
            content = fetch_bytes(url)
        except (HTTPError, URLError, TimeoutError):
            skipped += 1
            continue

        if file_name.lower().endswith(".svg") and not looks_like_svg(content):
            skipped += 1
            continue

        save_to_destinations(destinations, file_name, content)
        downloaded += 1

    return downloaded, skipped


def download_from_github_zip(extensions: list[str], destinations: list[Path]) -> tuple[int, int]:
    zip_bytes = fetch_bytes(GITHUB_ZIP_URL)
    downloaded = 0
    skipped = 0
    seen_names: dict[str, int] = {}

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        names = archive.namelist()
        for member in names:
            if member.endswith("/"):
                continue
            ext = Path(member).suffix.lower()
            if ext not in extensions:
                continue

            try:
                content = archive.read(member)
            except KeyError:
                skipped += 1
                continue

            file_name = ensure_unique_name(sanitize_name(member, extensions[0]), seen_names)
            if file_name.lower().endswith(".svg") and not looks_like_svg(content):
                skipped += 1
                continue

            save_to_destinations(destinations, file_name, content)
            downloaded += 1

    if downloaded == 0:
        raise ValueError("Không tìm thấy file phù hợp trong GitHub zip.")

    return downloaded, skipped


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
        downloaded, skipped = download_from_page(pack_url, extensions, destinations)
        print(f"✅ Tải trực tiếp từ trang pack thành công.")
    except (HTTPError, URLError, TimeoutError, ValueError) as err:
        if pack_url.rstrip("/") == DEFAULT_PACK_URL.rstrip("/"):
            print(f"⚠️ Không tải trực tiếp được từ allsvgicons ({err}).")
            print("↪ Đang thử fallback từ GitHub game-icons zip...")
            try:
                downloaded, skipped = download_from_github_zip(extensions, destinations)
                print("✅ Fallback GitHub thành công.")
            except (HTTPError, URLError, TimeoutError, ValueError) as fallback_err:
                print(f"❌ Fallback GitHub cũng thất bại: {fallback_err}")
                return 1
        else:
            print(f"❌ Không truy cập được trang pack: {err}")
            return 1

    print(f"✅ Đã tải: {downloaded}")
    print(f"⚠️ Bỏ qua: {skipped}")
    return 0 if downloaded else 1


if __name__ == "__main__":
    sys.exit(main())
