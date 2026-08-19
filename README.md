# Attendance-Management

勤怠管理アプリケーションです。
スマホ向けの打刻画面と、管理画面、Excel 自動転記スクリプトをまとめた構成です。

## 概要

- 共有の打刻画面は `index.html` を起点に利用する
- `kintai_hirakawa.html` と `kintai_wakayama.html` は、それぞれ専用のリダイレクトページ
- データは Supabase で管理する
- `register/kintai_register.html` でユーザーとデバイスを登録する
- `manage.html` で月次集計を確認できる

## 使い方

### 1. 初回登録

1. `register/kintai_register.html` を開く
2. 名前を入力して専用 URL を発行する
3. 発行された URL をスマホのホーム画面に追加する

### 2. 打刻

- 発行した URL を開くと専用の勤怠画面が表示される
- 出勤・退勤・修正を行える
- 今月の勤務時間の確認も可能

### 3. 管理

- `manage.html` でユーザーごとの集計を確認できる

---

## ファイル構成

```text
kintai/
├── index.html                    ← 共通の打刻画面
├── kintai_hirakawa.html          ← 平川用リダイレクト
├── kintai_wakayama.html          ← 若山用リダイレクト
├── manage.html                   ← 管理画面
├── README.md
├── register/
│   └── kintai_register.html      ← 登録・URL発行ページ
├── scripts/
│   ├── kintai.js                 ← 打刻アプリ本体
│   ├── kintai_register.js        ← 登録ページ用JS
│   └── manage.js                 ← 管理画面用JS
├── style/
│   ├── kintai.css                ← 打刻画面のスタイル
│   ├── kintai_register.css       ← 登録ページのスタイル
│   └── manage.css                ← 管理画面のスタイル
├── userScripts/
│   ├── fill_attendance.py         ← Excel 自動転記スクリプト
│   ├── 実行する.command          ← Mac 用ランチャー
│   └── 実行する.bat             ← Windows 用ランチャー
├── LICENSE
└── ...
```

---

## 補足

- Supabase の接続情報は各環境に合わせて設定する
- `userScripts/fill_attendance.py` は月末処理用の補助スクリプト
- 既存の個別ページは共通ページにリダイレクトする構成になっている

