# 勤怠管理ツール

打刻アプリ(スマホ) + Excel自動転記スクリプト(PC) のセットです。
データはSupabaseで管理しています。

---

## 打刻アプリ

### 初回登録
以下のURLを開いて名前を入力すると、あなた専用のURLが発行されます。

```
https://naokstarider2624114-art.github.io/kintai/kintai_register.html
```

- 発行されたURLをスマホのホーム画面に追加してください
- URL忘れた場合は同じページで同じ名前を入力すれば再表示されます

### 毎日の打刻
発行されたURLを開くだけで自分専用の打刻画面が開きます。

**できること**
- 出勤・退勤の打刻(30分単位・夜勤対応)
- 今月の合計勤務時間・営業日・残り営業日の確認
- 今月の勤務履歴の確認
- 打刻時間の修正

---

## Excel自動転記スクリプト

月末に `fill_attendance.py` を実行すると、Supabaseのデータを作業実績報告書に自動転記します。

### 初回セットアップ

**1. Pythonをインストール**

- Mac: https://www.python.org/downloads/macos/
- Windows: https://www.python.org/downloads/windows/
  - ⚠️ インストール時「Add python.exe to PATH」に必ずチェック

**2. openpyxlをインストール**

```
# Mac
python3.14 -m pip install openpyxl

# Windows
python -m pip install openpyxl
```

**3. フォルダを作成してファイルを入れる**

デスクトップに「勤怠表自動入力」フォルダを作り、以下を入れる。

```
勤怠表自動入力/
├── fill_attendance.py   ← このリポジトリからダウンロード
├── 実行する.command     ← Mac用
├── 実行する.bat         ← Windows用
└── 作業実績報告書_YYYYMM.xlsx  ← 先月分のExcel
```

**4. fill_attendance.py を編集**

メモ帳などで開いて、以下を自分の情報に書き換えて保存。

```python
TARGET_NAME = "若山直樹"  # ← 自分の名前に変更
```

### 毎月の使い方

1. `実行する.command`(Mac) または `実行する.bat`(Windows) をダブルクリック
2. 完了！

前月のExcelが自動で「過去」フォルダに移動し、当月のExcelが生成されます。

---

## ファイル一覧

| ファイル | 説明 |
|---|---|
| `kintai_register.html` | ユーザー登録・URL再発行ページ |
| `kintai.html` | 打刻アプリ本体(専用URLで開く) |
| `fill_attendance.py` | Excel自動転記スクリプト |
| `実行する.command` | Mac用ランチャー |
| `実行する.bat` | Windows用ランチャー |
