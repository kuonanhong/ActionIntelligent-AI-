#!/usr/bin/env python3
"""Serve this website package locally with Python 3; no extra dependencies."""

import argparse
import errno
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit
import webbrowser


SITE_ROOT = Path(__file__).resolve().parent


class WebsiteHandler(SimpleHTTPRequestHandler):
    def _safe_path(self):
        """Reject traversal and links that resolve outside this package."""
        try:
            path = unquote(urlsplit(self.path).path, errors="strict")
            if "\x00" in path or "\\" in path:
                return None
            parts = path.split("/")
            if ".." in parts:
                return None
            target = SITE_ROOT.joinpath(*(part for part in parts if part not in ("", ".")))
            resolved = target.resolve()
            if resolved != SITE_ROOT and SITE_ROOT not in resolved.parents:
                return None
            return target
        except (ValueError, OSError, UnicodeError, RuntimeError):
            return None

    def translate_path(self, path):
        # send_head validates this before SimpleHTTPRequestHandler opens a file.
        target = self._safe_path()
        return str(target) if target is not None else str(SITE_ROOT / ".denied")

    def send_head(self):
        target = self._safe_path()
        if target is None:
            self.send_error(403, "Access outside this website package is forbidden")
            return None
        if target.is_dir():
            # The standard handler checks directory indexes separately; validate
            # those too, so an index symlink cannot escape the package root.
            for name in ("index.html", "index.htm"):
                candidate = target / name
                if candidate.exists():
                    try:
                        resolved = candidate.resolve()
                        if resolved != SITE_ROOT and SITE_ROOT not in resolved.parents:
                            self.send_error(403, "Index outside this website package is forbidden")
                            return None
                    except (OSError, RuntimeError):
                        self.send_error(403, "Invalid website index")
                        return None
                    break
        return super().send_head()

    def list_directory(self, path):
        self.send_error(403, "Directory listing is disabled")
        return None

    def end_headers(self):
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        print("本機網站：" + format % args, file=sys.stderr, flush=True)


def main():
    parser = argparse.ArgumentParser(description="啟動聰動協會本機網站；只供本機瀏覽。")
    parser.add_argument("--port", type=int, default=8765, help="起始埠號，預設 8765")
    parser.add_argument("--no-browser", action="store_true", help="不自動開啟瀏覽器")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port 必須介於 1 與 65535。")
    if not (SITE_ROOT / "index.html").is_file():
        print("找不到 index.html。請將啟動器保留在完整網站資料夾內。", file=sys.stderr)
        return 1

    handler = functools.partial(WebsiteHandler, directory=str(SITE_ROOT))
    server = None
    for port in range(args.port, min(args.port + 5, 65536)):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            server.daemon_threads = True
            break
        except OSError as error:
            if error.errno not in (errno.EADDRINUSE, 10048):
                print("無法啟動本機網站：" + str(error), file=sys.stderr)
                return 1
            print("埠號 {} 已使用，嘗試下一個埠號。".format(port), flush=True)
    if server is None:
        print("已嘗試 5 個埠號，仍無法啟動。請關閉其他啟動器，或加上 --port 8800。", file=sys.stderr)
        return 1

    url = "http://127.0.0.1:{}/index.html".format(server.server_port)
    print("網站已啟動：" + url, flush=True)
    print("只服務本網站資料夾，只允許本機連線。", flush=True)
    print("YouTube 影片與外部服務需要網路；請保留此視窗，按 Ctrl+C 停止。", flush=True)
    if not args.no_browser:
        try:
            if not webbrowser.open(url):
                print("請自行複製上方網址到瀏覽器。", flush=True)
        except Exception:
            print("無法自動開啟瀏覽器，請自行複製上方網址。", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n本機網站已停止。", flush=True)
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
