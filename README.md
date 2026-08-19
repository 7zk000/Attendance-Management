# Attendance-Management

勤怠管理アプリケーションです。
スマホ向けの打刻画面と、管理画面、Excel 自動転記スクリプトをまとめた構成です。

## 概要

- 共有の打刻画面は `index.html` を起点に利用する
- 発行された専用 URL から共通の打刻ページを利用する
- データは Supabase で管理する
- `components/kintai_register.html` でユーザーとデバイスを登録する
- `components/manage.html` で月次集計を確認できる

## 使い方

### 1. 初回登録

1. `components/kintai_register.html` を開く
2. 名前を入力して専用 URL を発行する
3. 発行された URL をスマホのホーム画面に追加する
4. URL を忘れた場合は同じページで同じ名前を入力すると同じ URL が再表示される

### 2. 打刻

- 発行した URL を開くと専用の勤怠画面が表示される
- 出勤・退勤の打刻(30分単位・夜勤対応)、および打刻時間の修正を行える
- 今月の合計勤務時間・営業日・残り営業日・勤務履歴を確認できる

### 3. 管理

- `components/manage.html` でユーザーごとの集計を確認できる

### 4. 月末処理(Excel自動転記)

月末に `app/fill_attendance.py` を実行すると、Supabase の勤怠データを作業実績報告書(Excel)に自動転記できる。

**初回セットアップ**

1. Python をインストールする(Windows は「Add python.exe to PATH」に必ずチェック)
2. `openpyxl` をインストールする: `python -m pip install openpyxl`(Mac は `python3` コマンド)
3. 本リポジトリの `app/` フォルダの中身(`fill_attendance.py` ・ `実行する.command`(Mac) ・ `実行する.bat`(Windows))を丸ごとダウンロードし、作業用フォルダに入れる(GitHub上で `app/` を開き、各ファイルを個別にダウンロードするか、リポジトリ全体をZIPでダウンロードして `app/` フォルダだけ取り出す)
4. 同じ作業用フォルダに先月分の作業実績報告書(`作業実績報告書_YYYYMM.xlsx`)を入れる
5. `fill_attendance.py` 内の `TARGET_NAME` を自分の名前に書き換える

**毎月の使い方**

1. `実行する.command` / `実行する.bat` をダブルクリックする
2. 前月の Excel が自動で「過去」フォルダに移動し、当月分の Excel が生成される

---

## ファイル構成

```text
kintai/
├── index.html                    ← 共通の打刻画面
├── README.md
├── components/
│   ├── kintai_register.html      ← 登録・URL発行ページ
│   └── manage.html               ← 管理画面
├── scripts/
│   ├── kintai.js                 ← 打刻アプリ本体
│   ├── kintai_register.js        ← 登録ページ用JS
│   └── manage.js                 ← 管理画面用JS
├── style/
│   ├── kintai.css                ← 打刻画面のスタイル
│   ├── kintai_register.css       ← 登録ページのスタイル
│   └── manage.css                ← 管理画面のスタイル
├── supabase/
│   └── migrations/               ← Supabase の SQL Editor で順番に実行するマイグレーション
│       ├── 001_create_attendance_tables.sql
│       ├── 002_allow_anon_insert_user_devices.sql
│       ├── 003_harden_access.sql
│       └── 004_fix_users_is_admin_column.sql
├── app/
│   ├── fill_attendance.py        ← Excel 自動転記スクリプト(月末処理)
│   ├── 実行する.command          ← Mac 用ランチャー
│   └── 実行する.bat              ← Windows 用ランチャー
└── LICENSE
```

---

## 補足

- Supabase の接続情報は各環境に合わせて設定する
- 新しい環境で使う場合は `supabase/migrations/` 配下の SQL を番号順に Supabase の SQL Editor で実行してセットアップする

