#!/bin/bash
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
    exec python3 start_server.py "$@"
fi
printf '%s\n' '找不到 Python 3。請安裝 Python 3，或啟用提供 python3 的 conda 環境後再執行。' >&2
exit 1
