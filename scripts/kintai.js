const env = typeof window !== 'undefined' ? window : {};
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLIC_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase config missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading this script.');
}

const appEl = document.getElementById('app');

function getSession() {
  const raw = localStorage.getItem('kintai_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem('kintai_session', JSON.stringify(session));
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (res.status === 204) return null;

  const text = await res.text();
  if (!res.ok) {
    console.error('Supabase API error:', {
      path,
      status: res.status,
      statusText: res.statusText,
      body: text,
      options
    });
    throw new Error(`Supabase API error: ${res.status} ${res.statusText} :: ${text}`);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Supabase response was not JSON:', { path, text });
    return null;
  }
}

async function sbRpc(fnName, params) {
  return sbFetch(`rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

function calcWorkHours(checkin, checkout) {
  if (!checkin || !checkout) return 0;

  const parseValue = (value) => {
    if (!value) return null;
    if (value.includes(':') && value.split(':').length === 2) {
      const [hours, minutes] = value.split(':').map(Number);
      const base = new Date();
      base.setHours(hours, minutes, 0, 0);
      return base;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const start = parseValue(checkin);
  const end = parseValue(checkout);
  if (!start || !end) return 0;

  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(0, diffHours);
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}時間${m}分`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatYmd(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderEmptyState(message) {
  appEl.innerHTML = `
    <div class="card">
      <h1>勤怠打刻</h1>
      <p>${escapeHtml(message)}</p>
      <a class="btn" href="components/kintai_register.html">登録ページへ</a>
    </div>
  `;
}

async function loadUserByToken(token) {
  if (!token) return null;

  const rows = await sbRpc('load_user_by_token', { p_token: token });
  return rows && rows.length ? rows[0] : null;
}

async function getTodayRecord(name) {
  const today = new Date();
  const ymd = toDateInputValue(today);
  const rows = await sbFetch(`kintai?name=eq.${encodeURIComponent(name)}&date=eq.${encodeURIComponent(ymd)}&select=id,name,date,check_in,check_out,work_hours,remarks`);
  return rows && rows.length ? rows[0] : null;
}

async function getMonthRecords(name) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const start = `${year}-${month}-01`;
  const nextMonth = new Date(year, today.getMonth() + 1, 1);
  const nextMonthYmd = toDateInputValue(nextMonth);

  const rows = await sbFetch(
    `kintai?name=eq.${encodeURIComponent(name)}&date=gte.${encodeURIComponent(start)}&date=lt.${encodeURIComponent(nextMonthYmd)}&select=date,work_hours,check_in,check_out,remarks`
  );
  return rows || [];
}

function formatHistoryDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function getTodayLabel() {
  const now = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} (${days[now.getDay()]})`;
}

function getMonthLabel() {
  const now = new Date();
  return `${now.getMonth() + 1}月の勤務履歴`;
}

function showStatus(msg, type) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function buildTimeOptions() {
  const selIds = ['fix-checkin', 'fix-checkout'];
  selIds.forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        sel.appendChild(opt);
      }
    }
  });
}

function showFixPanel() {
  const panel = document.getElementById('fix-panel');
  if (!panel) return;
  panel.style.display = 'block';
}

function hideFixPanel() {
  const panel = document.getElementById('fix-panel');
  if (!panel) return;
  panel.style.display = 'none';
}

function calcBusinessDays() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  let total = 0;
  let remaining = 0;
  let todayIndex = 0;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) continue;
    total += 1;
    if (day === now.getDate()) todayIndex = total;
    if (day >= now.getDate()) remaining += 1;
  }

  return { total, remaining, todayIndex };
}

function resolveReasonWorkHours(reason, checkinValue, checkoutValue) {
  switch (reason) {
    case '有給':
      return 9;
    case '午前休':
    case '午後休':
      return 4.5;
    case '病欠':
    case 'その他':
      return 0;
    default:
      return calcWorkHours(checkinValue, checkoutValue);
  }
}

function getReasonOptions(kind) {
  if (kind === 'checkout') {
    return ['退勤', '早退', 'その他'];
  }

  return ['日勤', '夜勤', '病欠', '有給', '午前休', '午後休', 'その他'];
}

function getFixReasonOptions() {
  return ['日勤', '夜勤', '病欠', '有給', '午前休', '午後休', '退勤', '早退', 'その他'];
}

function syncFixTimeFields(reason) {
  const noTimeRequired = reason === '病欠';
  ['fix-checkin-row', 'fix-checkout-row'].forEach((id) => {
    const row = document.getElementById(id);
    if (row) row.style.display = noTimeRequired ? 'none' : 'block';
  });
}

let fixActionKind = 'checkin';

function updateAttendanceAction(todayRec) {
  const label = document.getElementById('attendance-label');
  const date = document.getElementById('attendance-date');
  const time = document.getElementById('attendance-time');
  const kindSelect = document.getElementById('attendance-kind');
  const button = document.getElementById('attendance-button');
  if (!label || !date || !time || !kindSelect || !button) return;

  const isCheckout = Boolean(todayRec && todayRec.check_in);
  const isComplete = Boolean(todayRec && todayRec.check_out);
  const kind = isCheckout ? 'checkout' : 'checkin';
  const options = getReasonOptions(kind);

  label.textContent = isCheckout ? '退勤' : '出勤';
  date.textContent = toDateInputValue(new Date());
  time.textContent = isCheckout ? (todayRec.check_out || '--:--') : (todayRec?.check_in || '--:--');
  time.classList.toggle('done', Boolean(isCheckout ? todayRec?.check_out : todayRec?.check_in));

  kindSelect.innerHTML = '';
  options.forEach((optionValue) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    kindSelect.appendChild(option);
  });
  if (todayRec?.remarks && options.includes(todayRec.remarks)) {
    kindSelect.value = todayRec.remarks;
  }

  button.dataset.kind = kind;
  button.classList.toggle('btn-checkin', kind === 'checkin');
  button.classList.toggle('btn-checkout', kind === 'checkout');
  button.textContent = isComplete ? '退勤済み' : (isCheckout ? '退勤する' : '出勤する');
  button.disabled = isComplete;
  fixActionKind = kind;

  const fixButton = document.getElementById('fix-button');
  if (fixButton) {
    fixButton.textContent = isCheckout ? '退勤時間を修正する' : '出勤時間を修正する';
  }
  const fixReason = document.getElementById('fix-reason');
  if (fixReason) {
    const currentValue = fixReason.value;
    const options = getFixReasonOptions();
    fixReason.innerHTML = options.map((label) => `<option value="${label}">${label}</option>`).join('');
    fixReason.value = options.includes(currentValue) ? currentValue : options[0];
    syncFixTimeFields(fixReason.value);
  }
}

function renderHistory(rows) {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!rows || rows.length === 0) {
    list.innerHTML = '<div class="history-empty">まだデータがありません</div>';
    return;
  }

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  list.innerHTML = rows.map((row) => {
    const date = new Date(row.date);
    const dayName = days[date.getDay()];
    const dateText = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}(${dayName})`;
    const reason = escapeHtml(row.remarks || '出勤');
    return `
      <div class="history-row">
        <div class="history-date">${dateText}</div>
        <div class="history-time">
          <div>${escapeHtml(row.check_in || '--:--')} → ${escapeHtml(row.check_out || '--:--')}</div>
          <div style="font-size: 11px; color: #888; margin-top: 2px;">理由: ${reason}</div>
        </div>
        <div class="history-hours">${(Number(row.work_hours) || 0).toFixed(1)}h</div>
      </div>
    `;
  }).join('');
}

async function upsertFixRecord({ date, checkin, checkout, kind = 'checkin', remarks = '日勤' }) {
  const name = userNameForRender;
  const token = userTokenForRender;

  const existing = await sbFetch(
    `kintai?name=eq.${encodeURIComponent(name)}&date=eq.${encodeURIComponent(date)}&select=*`
  );

  const workHours = resolveReasonWorkHours(remarks, checkin, checkout);
  const noTimeRequired = remarks === '病欠';
  const row = existing && existing.length ? existing[0] : null;

  const payload = {
    p_token: token,
    p_date: date,
    p_check_in: noTimeRequired ? null : (kind === 'checkin' ? checkin : (row?.check_in || checkin)),
    p_check_out: noTimeRequired ? null : (kind === 'checkout' ? checkout : (row?.check_out || checkout)),
    p_checkin_at: noTimeRequired
      ? null
      : (row ? row.checkin_at : (kind === 'checkin' ? new Date(`${date}T${checkin}:00`).toISOString() : null)),
    p_checkout_at: noTimeRequired
      ? null
      : (row ? row.checkout_at : (kind === 'checkout' ? new Date(`${date}T${checkout}:00`).toISOString() : null)),
    p_work_hours: workHours,
    p_remarks: remarks
  };

  await sbRpc('fix_kintai', payload);
  return row ? 'updated' : 'created';
}

async function submitFix() {
  const date = document.getElementById('fix-date').value;
  const kind = fixActionKind;
  const reason = document.getElementById('fix-reason')?.value || '日勤';
  const checkin = document.getElementById('fix-checkin').value;
  const checkout = document.getElementById('fix-checkout').value;

  const noTimeRequired = reason === '病欠';
  if (!date || (!noTimeRequired && (!checkin || !checkout))) {
    showStatus('日付・出勤・退勤時間を入力してください', 'error');
    return;
  }

  if (!userNameForRender || !userTokenForRender) {
    showStatus('ユーザー情報を特定できませんでした', 'error');
    return;
  }

  await upsertFixRecord({
    date,
    checkin,
    checkout,
    kind,
    remarks: reason
  });

  showStatus('修正しました', 'ok');
  hideFixPanel();
  if (typeof refreshAttendancePage === 'function') refreshAttendancePage();
  else location.reload();
}

function renderApp(user) {
  const businessDays = calcBusinessDays();
  userNameForRender = user.name;
  userTokenForRender = user.token;

  appEl.innerHTML = `
    <div class="wrap">
      <div class="header">
        <h1>勤怠打刻</h1>
        <div class="name">${escapeHtml(user.name)}</div>
        <div class="date">${getTodayLabel()}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">合計稼働時間</div>
          <div><span class="stat-value green" id="monthly-total">--</span><span class="stat-unit">h</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">残り営業日</div>
          <div><span class="stat-value orange" id="biz-remaining">${businessDays.remaining}</span><span class="stat-unit">日</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">1日平均稼働時間</div>
          <div><span class="stat-value" id="avg-hours">--</span><span class="stat-unit">h</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">今月の営業日数</div>
          <div><span class="stat-value" id="biz-total-text">${businessDays.total}</span><span class="stat-unit">日</span></div>
        </div>
      </div>

      <div id="loading" class="loading">読み込み中...</div>

      <div id="main" style="display:none">
        <div class="card attendance-card">
          <div class="attendance-section">
            <div class="card-head">
              <div class="card-label" id="attendance-label">出勤</div>
              <div class="card-date" id="attendance-date">${toDateInputValue(new Date())}</div>
            </div>
            <div class="time-val" id="attendance-time">--:--</div>
            <div class="fix-row" style="margin-bottom: 0.75rem;">
              <select id="attendance-kind" style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 15px; background: #fff;"></select>
            </div>
            <button class="btn btn-checkin" id="attendance-button" data-kind="checkin">出勤する</button>
          </div>
          <button class="btn btn-fix" id="fix-button" onclick="showFixPanel()">出勤時間を修正する</button>
        </div>
      </div>

      <div class="fix-panel" id="fix-panel">
        <h2>打刻修正</h2>
        <div class="fix-row">
          <label>日付</label>
          <input type="date" id="fix-date">
        </div>
        <div class="fix-row">
          <label>理由</label>
          <select id="fix-reason"></select>
        </div>
        <div class="fix-row" id="fix-checkin-row">
          <label>出勤時間</label>
          <select id="fix-checkin"></select>
        </div>
        <div class="fix-row" id="fix-checkout-row">
          <label>退勤時間</label>
          <select id="fix-checkout"></select>
        </div>
        <button class="btn btn-fix-submit" onclick="submitFix()">修正を送信</button>
        <button class="btn btn-fix-cancel" onclick="hideFixPanel()">キャンセル</button>
      </div>

      <div class="status" id="status"></div>

      <div class="history" id="history-panel" style="display:none">
        <h2 id="history-title">${getMonthLabel()}</h2>
        <div id="history-list"></div>
      </div>

      <div style="margin-top: 1rem; text-align: center;">
        <button type="button" class="btn btn-fix" onclick="window.location.href='components/manage.html'">管理用画面へ</button>
      </div>
    </div>
  `;

  buildTimeOptions();

  const fixReason = document.getElementById('fix-reason');
  if (fixReason) {
    fixReason.innerHTML = getFixReasonOptions()
      .map((label) => `<option value="${label}">${label}</option>`)
      .join('');
    fixReason.addEventListener('change', () => syncFixTimeFields(fixReason.value));
    syncFixTimeFields(fixReason.value);
  }

  const attendanceButton = document.getElementById('attendance-button');
  if (attendanceButton) {
    attendanceButton.addEventListener('click', async () => {
      const kind = attendanceButton.dataset.kind || 'checkin';
      const reason = document.getElementById('attendance-kind')?.value || (kind === 'checkout' ? '退勤' : '日勤');
      await stamp(kind, user.token, reason);
      refreshAttendancePage();
    });
  }

  refreshAttendancePage();
}

let userNameForRender = '';
let userTokenForRender = '';

async function refreshAttendancePage() {
  if (!userNameForRender) return;

  const [records, todayRec] = await Promise.all([
    getMonthRecords(userNameForRender),
    getTodayRecord(userNameForRender)
  ]);

  const totalHours = (records || []).reduce((sum, row) => sum + (Number(row.work_hours) || 0), 0);
  const totalWorkDays = (records || []).filter((row) => Number(row.work_hours) > 0).length;
  const averageHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;

  const monthTotal = document.getElementById('monthly-total');
  if (monthTotal) monthTotal.textContent = Number(totalHours || 0).toFixed(1);

  const avgHours = document.getElementById('avg-hours');
  if (avgHours) avgHours.textContent = Number(averageHours || 0).toFixed(1);

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const main = document.getElementById('main');
  if (main) main.style.display = 'block';

  updateAttendanceAction(todayRec);

  renderHistory(records || []);
  const historyPanel = document.getElementById('history-panel');
  if (historyPanel) historyPanel.style.display = 'block';

  const fixDate = document.getElementById('fix-date');
  if (fixDate) {
    fixDate.value = toDateInputValue(new Date());
  }

  const fixCheckin = document.getElementById('fix-checkin');
  const fixCheckout = document.getElementById('fix-checkout');
  if (fixCheckin && todayRec && todayRec.check_in) fixCheckin.value = todayRec.check_in;
  if (fixCheckout && todayRec && todayRec.check_out) fixCheckout.value = todayRec.check_out;
}

async function stamp(kind, token, reason = '日勤') {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);

  const current = await getTodayRecord(userNameForRender);

  const workHours = kind === 'checkout'
    ? resolveReasonWorkHours(
        reason,
        current?.checkin_at || current?.check_in,
        current?.checkout_at || now.toISOString()
      )
    : (current?.work_hours || 0);

  await sbRpc('stamp_kintai', {
    p_token: token,
    p_kind: kind,
    p_time: time,
    p_at: now.toISOString(),
    p_work_hours: workHours,
    p_remarks: reason
  });
}

async function init() {
  if (!appEl) return;

  const queryToken = getQueryParam('token');
  const session = getSession();

  let user = null;

  if (queryToken) {
    user = await loadUserByToken(queryToken);
    if (user) {
      setSession({ name: user.name, token: user.token });
    }
  }

  if (!user && session && session.name && session.token) {
    user = await loadUserByToken(session.token);
  }

  if (!user) {
    renderEmptyState('登録済みの端末ではありません。初回登録を行ってください。');
    return;
  }

  renderApp(user);
}

init();
