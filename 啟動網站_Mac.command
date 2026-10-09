#!/bin/bash
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
    python3 start_server.py "$@"
    status=$?
else
    printf '%s\n' '找不到 Python 3。請安裝 Python 3，或在已啟用 conda 的終端機執行 python3 start_server.py。'
    status=1
fi
if [ "$status" -ne 0 ]; then
    printf '%s\n' '網站啟動失敗。按 Enter 關閉視窗。'
    read -r _
fi
exit "$status"
