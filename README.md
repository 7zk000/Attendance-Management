# Attendance-Management

勤怠管理アプリケーションです。
スマホ向けの打刻画面と、管理画面、Excel 自動転記スクリプトをまとめた構成です。
フロントエンドは SvelteKit + Tailwind CSS + [Rabee UI](https://rabeeui.com/) で実装しています。

## 概要

- 共有の打刻画面はトップページ(`/`)を起点に利用する
- 発行された専用 URL から共通の打刻ページを利用する
- データは Supabase で管理する
- `/register` でユーザーとデバイスを登録する
- `/manage` で月次集計を確認できる

## 使い方

### 1. 初回登録

1. `/register` を開く
2. 名前を入力して専用 URL を発行する
3. 発行された URL をスマホのホーム画面に追加する
4. URL を忘れた場合は同じページで同じ名前を入力すると同じ URL が再表示される

### 2. 打刻

- 発行した URL を開くと専用の勤怠画面が表示される
- 出勤・退勤の打刻(30分単位・夜勤対応)、および打刻時間の修正を行える
- 今月の合計勤務時間・営業日・残り営業日・勤務履歴を確認できる

### 3. 管理

- `/manage` でユーザーごとの集計を確認できる

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

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 静的ファイルを build/ に出力
npm run preview  # build/ をローカルでプレビュー
npm run check    # 型チェック(svelte-check)
```

Supabase の接続情報は `.env` の `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`(公開用の publishable key なのでコミット済み)で設定している。管理画面のログインコードは `PUBLIC_ADMIN_ACCESS_TOKEN` で設定する(未設定時は `admin`)。

`npm run build` は `@sveltejs/adapter-static` で `build/` にプリレンダリングされた静的サイトを出力する(`/`・`/register`・`/manage` の3ページとも実データ取得はすべてクライアント側でSupabaseを直接呼び出すため、サーバー実行環境は不要)。Vercel は SvelteKit プロジェクトとして自動検出されるはずなので、追加のビルド設定は基本的に不要。

---

## ファイル構成

```text
kintai/
├── src/
│   ├── app.html                  ← HTMLシェル
│   ├── app.css                   ← Tailwind + Rabee UI トークンの読み込み
│   ├── lib/
│   │   ├── rabeeui.css           ← Rabee UI のカラートークン定義(ダーク基調にカスタマイズ)
│   │   ├── supabase.ts           ← Supabase クライアント
│   │   ├── api.ts                ← Supabase へのデータアクセス関数
│   │   ├── kintai-utils.ts       ← 稼働時間計算・CSV出力などの純粋関数
│   │   ├── session.ts            ← 端末セッション・管理者ログイン状態の保存
│   │   └── components/ui/        ← Rabee UI を元にしたコンポーネント(Button, Card, Input, Select, Table, Modal, Toast など)
│   └── routes/
│       ├── +page.svelte          ← 打刻画面(`/`)
│       ├── register/+page.svelte ← 登録・URL発行ページ(`/register`)
│       └── manage/+page.svelte   ← 管理画面(`/manage`)
├── supabase/
│   └── migrations/               ← Supabase の SQL Editor で順番に実行するマイグレーション
│       ├── 001_create_attendance_tables.sql
│       ├── 002_allow_anon_insert_user_devices.sql
│       ├── 003_harden_access.sql
│       ├── 004_fix_users_is_admin_column.sql
│       └── 005_fix_register_user_ambiguous_id.sql
├── app/
│   ├── fill_attendance.py        ← Excel 自動転記スクリプト(月末処理)
│   ├── 実行する.command          ← Mac 用ランチャー
│   └── 実行する.bat              ← Windows 用ランチャー
├── package.json
├── svelte.config.js
├── vite.config.ts
└── LICENSE
```

---

## 補足

- 新しい環境で使う場合は `supabase/migrations/` 配下の SQL を番号順に Supabase の SQL Editor で実行してセットアップする
