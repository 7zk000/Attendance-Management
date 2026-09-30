#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Supabase勤怠DB -> 作業実績報告書(Excel) 自動転記スクリプト

【使い方】
このスクリプトと同じフォルダに、全員分の先月分Excel(ファイル名にそれぞれの
名前が入っているもの)をまとめて入れて、
ランチャー(実行する.command / 実行する.bat)をダブルクリックすると、
Supabaseに登録されている全ユーザー分を一括で転記する。
テンプレートが見つからない人はスキップされ、実行結果の一覧に表示される。

【フォルダ構成】
  勤怠表自動入力/
  ├── fill_attendance.py
  ├── 実行する.command (Mac)
  ├── 実行する.bat     (Windows)
  ├── 作業実績報告書(会社名_平川佳樹)_YYYYMM.xlsx  ← 前回の出力が自動で残る
  ├── 作業実績報告書(会社名_山田太郎)_YYYYMM.xlsx
  └── 過去/
      └── ...
"""

import sys, datetime, zipfile, shutil, os, glob, re, json
import urllib.request
import urllib.parse

# ============================================================
SUPABASE_URL = "https://fepmlhggkmdfhcfcyuxi.supabase.co"
SUPABASE_KEY = "sb_publishable_ccPWCQ40MjmvRAR4w8SefA_RW3AQ_37"
# ============================================================

SHEET_NAME  = "作業完了報告書"
FIRST_ROW   = 20
LAST_ROW    = 50
ARCHIVE_DIR = "過去"

def time_to_excel(t: datetime.time) -> float:
    return round((t.hour * 3600 + t.minute * 60) / 86400, 10)


# -------------------------------------------------------
# 勤怠計算(数式キャッシュ値を直接生成)
# -------------------------------------------------------
W17 = 30  # 時間単位(分)

def calc_row(start_time, end_time, break_time):
    """G,H,I列から数式セルの計算値を生成する(夜勤対応)"""
    p = start_time.hour * 60 + start_time.minute
    q = end_time.hour * 60 + end_time.minute
    s = break_time.hour * 60 + break_time.minute

    if p == 0 and q == 0:
        return {}

    # 退勤が出勤以下なら日をまたぐ(夜勤)
    r_val = 0 if p < q else 1
    t = (q - p - s) if r_val == 0 else (q + 1440 - p - s)

    u = int(t // 60)
    v = t - u * 60
    w = int(v // W17)
    x = w * W17
    y = x / 60
    j = (u * 60 + x) / (24 * 60)
    n = u + y
    z = max(0, (u * 60 + x) - 480)

    aa = int(z // 60)
    ab_raw = z - aa * 60
    ab = int((ab_raw // W17) * W17)
    k = (aa * 60 + ab) / (24 * 60) if z > 0 else 0

    return {
        'P': p, 'Q': q, 'R': r_val, 'S': s, 'T': t,
        'U': u, 'V': v, 'W': w, 'X': x, 'Y': y,
        'J': j, 'N': n, 'Z': z, 'K': k,
        'AA': aa, 'AB': ab,
    }


def replace_cell_value_only(xml: str, cell_ref: str, value) -> str:
    """数式セルのキャッシュ値(<v>)だけを更新する(数式<f>はそのまま保持)"""
    import re as _re
    # <v>既存値</v> を <v>新値</v> に置換(数式セル内のみ)
    def replacer(m):
        cell_xml = m.group()
        # <v>...</v>を置換
        new_v = f'<v>{value}</v>'
        if '<v>' in cell_xml:
            cell_xml = _re.sub(r'<v>[^<]*</v>', new_v, cell_xml)
        return cell_xml

    pattern = rf'<c r="{_re.escape(cell_ref)}"[^>]*>.*?</c>'
    return _re.sub(pattern, replacer, xml, flags=_re.DOTALL)


# -------------------------------------------------------
# XML直接編集(署名欄を保持するため)
# -------------------------------------------------------
def replace_cell_inplace(xml: str, cell_ref: str, value) -> str:
    """セルの値をXML上で直接置換。セル構造・スタイルは保持する"""

    def to_empty(m):
        tag = re.match(r'<c ([^>]+?)(?<!/)>', m.group())
        return f'<c {tag.group(1)}/>' if tag else m.group()

    def to_value(m):
        tag = re.match(r'<c ([^>]+?)(?<!/)>', m.group())
        return f'<c {tag.group(1)}><v>{value}</v></c>' if tag else m.group()

    # 開閉タグパターン(自己閉じ以外)
    p_open = rf'<c r="{re.escape(cell_ref)}"[^>]*(?<!/)>.*?</c>'
    xml, n1 = re.subn(p_open, to_empty if value is None else to_value, xml, flags=re.DOTALL)

    if n1 == 0 and value is not None:
        # 自己閉じパターン
        def self_to_value(m):
            return f'<c r="{cell_ref}"{m.group(1)}><v>{value}</v></c>'
        p_self = rf'<c r="{re.escape(cell_ref)}"([^>]*)/>'
        xml, _ = re.subn(p_self, self_to_value, xml)

    return xml


def _escape_xml_text(text: str) -> str:
    return (text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def replace_cell_inplace_text(xml: str, cell_ref: str, text) -> str:
    """文字列セルをXML上で直接置換する(t="inlineStr" として書き込む)。
    L列はテンプレート側で t="s"(共有文字列)になっているため、数値用の
    replace_cell_inplace とは別に、文字列として正しく認識される形で書き込む。
    """

    def to_empty(m):
        tag = re.match(r'<c ([^>]+?)(?<!/)>', m.group())
        attrs = re.sub(r'\s*t="[^"]*"', '', tag.group(1)) if tag else ''
        return f'<c {attrs}/>'

    def to_value(m):
        tag = re.match(r'<c ([^>]+?)(?<!/)>', m.group())
        attrs = re.sub(r'\s*t="[^"]*"', '', tag.group(1)) if tag else ''
        escaped = _escape_xml_text(text)
        return f'<c {attrs} t="inlineStr"><is><t xml:space="preserve">{escaped}</t></is></c>'

    p_open = rf'<c r="{re.escape(cell_ref)}"[^>]*(?<!/)>.*?</c>'
    xml, n1 = re.subn(p_open, to_empty if text is None else to_value, xml, flags=re.DOTALL)

    if n1 == 0 and text is not None:
        def self_to_value(m):
            attrs = re.sub(r'\s*t="[^"]*"', '', m.group(1))
            escaped = _escape_xml_text(text)
            return f'<c r="{cell_ref}"{attrs} t="inlineStr"><is><t xml:space="preserve">{escaped}</t></is></c>'
        p_self = rf'<c r="{re.escape(cell_ref)}"([^>]*)/>'
        xml, _ = re.subn(p_self, self_to_value, xml)

    return xml


HALF_DAY_LEAVE_REASONS = {'午前休', '午後休'}


def build_work_content_text(location, task_type, remarks):
    """L列(作業内容、勤怠等)に書き込むテキストを組み立てる。
    - 日勤・夜勤で場所・作業内容が記録されている日は「【場所】作業内容」
    - 午前休・午後休(場所・作業内容が記録されている)は「【場所】作業内容・午前休」のように休暇種別を付記
    - 病欠・有給・私用のため・自社用のためなど、時刻を記録しない休みの日はremarksをそのまま表示
    """
    location = (location or '').strip()
    task_type = (task_type or '').strip()
    remarks = (remarks or '').strip()

    if remarks in HALF_DAY_LEAVE_REASONS and (location or task_type):
        return f"{location}{task_type}・{remarks}"
    if location or task_type:
        return f"{location}{task_type}"
    if remarks:
        return remarks
    return None


def fix_time_cell_styles(xml: str) -> str:
    """G・H・I列20〜50行の時刻セルのスタイルをh:mm形式(s=15)に修正する"""
    def fix_style(m):
        tag = m.group()
        # s="数字" を s="15" に置き換え
        tag = re.sub(r' s="[0-9]+"', ' s="15"', tag)
        # t="n" などの型指定を除去(時刻は数値なのでtは不要)
        tag = re.sub(r' t="[^"]*"', '', tag)
        return tag
    for col in ['G', 'H', 'I']:
        for row in range(20, 51):
            xml = re.sub(
                rf'<c r="{col}{row}"[^>]*/?>',
                fix_style,
                xml
            )
    return xml


def edit_xml_and_save(source_path: str, output_path: str,
                      year: int, month: int, rows: list):
    """元ファイルのzipをベースにsheet1.xmlだけ編集して保存"""
    with zipfile.ZipFile(source_path, 'r') as z:
        sheet_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')

    # 年月を更新
    sheet_xml = replace_cell_inplace(sheet_xml, 'H1', year)
    sheet_xml = replace_cell_inplace(sheet_xml, 'J1', month)

    # G,H,I,L列の20〜50行をクリア
    for col in ['G', 'H', 'I', 'L']:
        for row in range(FIRST_ROW, LAST_ROW + 1):
            sheet_xml = replace_cell_inplace(sheet_xml, f'{col}{row}', None)

    # 時刻セルのスタイルをh:mm形式に修正
    sheet_xml = fix_time_cell_styles(sheet_xml)

    # 勤怠データと計算値を書き込む
    count = 0
    for row_data in rows:
        day = row_data['day']
        r = FIRST_ROW + day - 1
        s_time = row_data['start_time']
        e_time = row_data['end_time']
        b_time = row_data['break_time']

        # 病欠・有給など時刻を記録しない休みの日はG,H,Iを空欄のままにする
        # (総労働時間・出社日数の集計はG,H,I由来のため、時刻を入れると
        # 実際には働いていない日が稼働扱いになってしまう)。
        if s_time is not None and e_time is not None:
            sheet_xml = replace_cell_inplace(sheet_xml, f'G{r}', time_to_excel(s_time))
            sheet_xml = replace_cell_inplace(sheet_xml, f'H{r}', time_to_excel(e_time))
            sheet_xml = replace_cell_inplace(sheet_xml, f'I{r}', time_to_excel(b_time))

            # 数式のキャッシュ値を直接計算して書き込む
            vals = calc_row(s_time, e_time, b_time)
            for col, val in vals.items():
                if val != "":
                    sheet_xml = replace_cell_value_only(sheet_xml, f'{col}{r}', val)

        # L列(作業内容、勤怠等。L:Mは結合セルのためLにだけ書き込む)
        l_text = build_work_content_text(
            row_data.get('location'), row_data.get('task_type'), row_data.get('remarks')
        )
        if l_text:
            sheet_xml = replace_cell_inplace_text(sheet_xml, f'L{r}', l_text)

        count += 1

    # 元ファイルをコピーしてsheet1.xml・workbook.xmlを差し替え
    tmp = output_path + '.tmp'
    shutil.copy2(source_path, tmp)
    with zipfile.ZipFile(tmp, 'r') as zin, \
         zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.namelist():
            if item == 'xl/worksheets/sheet1.xml':
                zout.writestr(item, sheet_xml.encode('utf-8'))
            elif item == 'xl/workbook.xml':
                wb_xml = zin.read(item).decode('utf-8')
                # 開いたときに全数式を強制再計算
                wb_xml = re.sub(
                    r'<calcPr[^/]*/?>',
                    '<calcPr calcId="999" fullCalcOnLoad="1"/>',
                    wb_xml
                )
                if '<calcPr' not in wb_xml:
                    wb_xml = wb_xml.replace('</workbook>', '<calcPr calcId="999" fullCalcOnLoad="1"/></workbook>')
                zout.writestr(item, wb_xml.encode('utf-8'))
            else:
                zout.writestr(item, zin.read(item))
    os.remove(tmp)
    return count


# -------------------------------------------------------
# Supabase読み込み
# -------------------------------------------------------
def parse_time(s: str) -> datetime.time:
    s = s.strip().replace("'", "")
    parts = s.split(":")
    return datetime.time(int(parts[0]), int(parts[1]))


def fetch_all_user_names() -> list:
    """Supabaseに登録されている全ユーザー名を取得する(打刻画面の登録者一覧)"""
    url = f"{SUPABASE_URL}/rest/v1/rpc/list_user_names"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as res:
        records = json.loads(res.read())
    return sorted({(r.get("name") or "").strip() for r in records if r.get("name")})


def fetch_sheet_rows(year: int, month: int, target_name: str) -> list:
    """Supabaseから当月の勤怠データを取得する"""
    import urllib.parse
    month_start = f"{year}-{month:02d}-01"
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    month_end = f"{next_year}-{next_month:02d}-01"

    url = (f"{SUPABASE_URL}/rest/v1/kintai"
           f"?name=eq.{urllib.parse.quote(target_name)}"
           f"&date=gte.{month_start}"
           f"&date=lt.{month_end}"
           f"&select=*&order=date.asc")

    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req) as res:
        records = json.loads(res.read())

    rows = []
    for r in records:
        date_str     = r.get("date", "")
        checkin_str  = r.get("check_in") or ""
        checkout_str = r.get("check_out") or ""
        remarks      = r.get("remarks") or ""

        if not date_str:
            continue
        # 病欠・有給など時刻を記録しない休みの日はcheck_in/check_outが無いが、
        # remarksだけでもL列に表示するため行として残す。
        if not checkin_str and not checkout_str and not remarks:
            continue

        try:
            dt = datetime.datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except Exception:
            continue

        if dt.year != year or dt.month != month:
            continue

        if checkin_str and checkout_str:
            start = parse_time(checkin_str)
            end   = parse_time(checkout_str)
            ci = start.hour * 60 + start.minute
            co = end.hour * 60 + end.minute
            if co <= ci:
                co += 1440  # 夜勤対応
            diff_mins = co - ci
            break_hours = 1 if diff_mins > 480 else 0
            break_time = datetime.time(break_hours, 0)
        else:
            start = None
            end = None
            break_time = None

        rows.append({
            "day":        dt.day,
            "start_time": start,
            "end_time":   end,
            "break_time": break_time,
            "location":   r.get("location"),
            "task_type":  r.get("task_type"),
            "remarks":    remarks,
        })

    return rows


# -------------------------------------------------------
# ファイル検出・アーカイブ
# -------------------------------------------------------
def list_candidate_excels(folder: str) -> list:
    """フォルダ内のテンプレート候補(.xlsx)を一覧する(一時ファイル・過去フォルダは除く)"""
    archive_dir = os.path.join(folder, ARCHIVE_DIR)
    return [
        f for f in glob.glob(os.path.join(folder, "*.xlsx"))
        if not os.path.basename(f).startswith("~$")
        and os.path.dirname(os.path.abspath(f)) != os.path.abspath(archive_dir)
    ]


def find_excel_for_name(folder: str, name: str) -> str:
    """ファイル名に名前が含まれる .xlsx を探す(複数あれば最終更新日時が新しい方)"""
    candidates = [f for f in list_candidate_excels(folder) if name in os.path.basename(f)]
    if not candidates:
        raise FileNotFoundError(f"「{name}」のテンプレートExcelが見つかりません。")
    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]


def archive_source(source_path: str, folder: str) -> str:
    archive_dir = os.path.join(folder, ARCHIVE_DIR)
    os.makedirs(archive_dir, exist_ok=True)
    dest = os.path.join(archive_dir, os.path.basename(source_path))
    shutil.move(source_path, dest)
    return dest


def determine_target_year_month(filename: str):
    """テンプレートのファイル名に含まれるYYYYMMの翌月を対象年月として返す
    (見つからない場合は今日から見た先月を対象とする)"""
    m = re.search(r'(\d{4})(\d{2})', filename)
    if m:
        src_year, src_month = int(m.group(1)), int(m.group(2))
        year  = src_year if src_month < 12 else src_year + 1
        month = src_month + 1 if src_month < 12 else 1
    else:
        today = datetime.date.today()
        prev  = today.replace(day=1) - datetime.timedelta(days=1)
        year, month = prev.year, prev.month
    return year, month


def process_person(folder: str, name: str) -> str:
    """1人分の転記を実行し、結果メッセージを返す。
    テンプレートが見つからない場合はFileNotFoundErrorがそのまま伝播する。
    """
    source_path = find_excel_for_name(folder, name)
    base = os.path.basename(source_path)
    year, month = determine_target_year_month(base)

    rows = fetch_sheet_rows(year, month, name)
    if not rows:
        return f"⚠️  {name}: {year}年{month}月のデータが見つかりませんでした(スキップ)"

    new_ym   = f"{year}{month:02d}"
    new_name = re.sub(r'\d{6}(?=\.xlsx)', new_ym, base)
    if new_name == base:
        new_name = base.replace(".xlsx", f"_{new_ym}.xlsx")
    output_path = os.path.join(folder, new_name)

    count = edit_xml_and_save(source_path, output_path, year, month, rows)

    if os.path.abspath(source_path) != os.path.abspath(output_path):
        archive_source(source_path, folder)

    return f"✅ {name}: {year}年{month}月分を作成しました({count}件、{new_name})"


# -------------------------------------------------------
# メイン
# -------------------------------------------------------
def main():
    folder = os.path.dirname(os.path.abspath(__file__))

    print("🔄 登録ユーザー一覧を取得中...")
    try:
        names = fetch_all_user_names()
    except Exception as e:
        print(f"❌ ユーザー一覧の取得に失敗しました: {e}")
        input("\nEnterキーを押して終了してください...")
        sys.exit(1)

    if not names:
        print("⚠️  登録されているユーザーがいません。")
        input("\nEnterキーを押して終了してください...")
        sys.exit(1)

    print(f"👥 対象ユーザー: {len(names)}名 ({'、'.join(names)})")
    print()

    results = []
    for name in names:
        print(f"--- {name} ---")
        try:
            message = process_person(folder, name)
        except FileNotFoundError as e:
            message = f"⏭️  {name}: {e}(スキップ)"
        except Exception as e:
            message = f"❌ {name}: 処理中にエラーが発生しました({e})(スキップ)"
        print(message)
        results.append(message)
        print()

    print("=" * 40)
    print("実行結果まとめ")
    print("=" * 40)
    for message in results:
        print(message)

    input("\nEnterキーを押して終了してください...")


if __name__ == "__main__":
    main()
