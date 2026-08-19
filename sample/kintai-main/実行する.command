#!/bin/bash
# Mac用ランチャー - ダブルクリックで実行

# このファイルがある場所に移動
cd "$(dirname "$0")"

# Pythonを探して実行(複数バージョンに対応)
if command -v python3.14 &> /dev/null; then
    python3.14 fill_attendance.py
elif command -v python3 &> /dev/null; then
    python3 fill_attendance.py
else
    echo "❌ Pythonが見つかりません。インストールしてください。"
    echo "https://www.python.org/downloads/macos/"
    read -p "Enterキーを押して終了..."
fi
