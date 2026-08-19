const env = typeof window !== 'undefined' ? window : {};
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLIC_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase config missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading this script.');
}

const appEl = document.getElementById('app');

function getDeviceId() {
  const key = 'kintai_device_id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    const raw = [
      navigator.userAgent,
      navigator.platform,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      Date.now().toString(36)
    ].join('|');
    deviceId = btoa(encodeURIComponent(raw)).replace(/=+$/g, '').slice(0, 32);
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

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
  if (!text) return null;
  return JSON.parse(text);
}

function calcWorkHours(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const start = new Date(checkin);
  const end = new Date(checkout);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffHours = (end - start) / (1000 * 60 * 60);
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
      <a class="btn" href="register/kintai_register.html">登録ページへ</a>
    </div>
  `;
}

async function loadUserByToken(token, deviceId) {
  if (!token) return null;

  const baseQuery = `users?token=eq.${encodeURIComponent(token)}&select=id,name,token,device_id`;
  const rows = await sbFetch(baseQuery);
  if (!rows || rows.length === 0) return null;

  if (deviceId) {
    const byDevice = rows.find((row) => row.device_id === deviceId);
    if (byDevice) return byDevice;
  }

  return rows[0];
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
  const rows = await sbFetch(`kintai?name=eq.${encodeURIComponent(name)}&date=like.${encodeURIComponent(`${year}-${month}%`)}&select=date,work_hours,check_in,check_out`);
  return rows || [];
}

function renderHistory(rows) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="4" class="empty">今月の記録はまだありません。</td>
      </tr>
    `;
  }

  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(formatYmd(row.date))}</td>
      <td>${escapeHtml(row.check_in || '-')}</td>
      <td>${escapeHtml(row.check_out || '-')}</td>
      <td>${escapeHtml((Number(row.work_hours) || 0).toFixed(1) + 'h')}</td>
    </tr>
  `).join('');
}

function renderApp(user) {
  const monthRecords = getMonthRecords(user.name);
  const todayRecord = getTodayRecord(user.name);

  Promise.all([monthRecords, todayRecord]).then(([records, todayRec]) => {
    const totalHours = (records || []).reduce((sum, row) => sum + (Number(row.work_hours) || 0), 0);
    const monthLabel = `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`;

    appEl.innerHTML = `
      <div class="wrap" id="app">
        <div class="card">
          <h1>勤怠打刻</h1>
          <p class="user-name">${escapeHtml(user.name)} さん</p>

          <div class="summary-box">
            <div>
              <span>今月合計</span>
              <strong>${(Number(totalHours) || 0).toFixed(1)}h</strong>
            </div>
          </div>

          <div class="today-box">
            <div>今日の記録</div>
            <div>${todayRec ? `入室 ${escapeHtml(todayRec.check_in || '-')} / 退室 ${escapeHtml(todayRec.check_out || '-')} / ${escapeHtml((Number(todayRec.work_hours) || 0).toFixed(1))}h` : 'まだ未登録です'}</div>
          </div>

          <div class="action-group">
            <button class="btn" data-kind="checkin">出勤</button>
            <button class="btn" data-kind="checkout">退勤</button>
          </div>

          <div class="history-box">
            <h2>${escapeHtml(monthLabel)} の履歴</h2>
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                ${renderHistory(records || [])}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    appEl.querySelectorAll('[data-kind]').forEach((button) => {
      button.addEventListener('click', async () => {
        const kind = button.dataset.kind;
        await stamp(kind, user.name);
        location.reload();
      });
    });
  }).catch((error) => {
    console.error(error);
    renderEmptyState('勤怠データの取得に失敗しました。');
  });
}

async function stamp(kind, name) {
  const now = new Date();
  const date = toDateInputValue(now);
  const time = now.toTimeString().slice(0, 5);

  const current = await getTodayRecord(name);

  if (!current) {
    const payload = {
      name,
      date,
      check_in: kind === 'checkin' ? time : null,
      check_out: kind === 'checkout' ? time : null,
      checkin_at: kind === 'checkin' ? now.toISOString() : null,
      checkout_at: kind === 'checkout' ? now.toISOString() : null,
      work_hours: 0,
      remarks: ''
    };

    await sbFetch('kintai', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return;
  }

  const nextPayload = {
    ...current,
    check_in: kind === 'checkin' ? (current.check_in || time) : current.check_in,
    check_out: kind === 'checkout' ? (current.check_out || time) : current.check_out,
    checkin_at: kind === 'checkin' ? (current.checkin_at || now.toISOString()) : current.checkin_at,
    checkout_at: kind === 'checkout' ? (current.checkout_at || now.toISOString()) : current.checkout_at,
    work_hours: calcWorkHours(
      kind === 'checkin' ? (current.checkin_at || now.toISOString()) : current.checkin_at,
      kind === 'checkout' ? (current.checkout_at || now.toISOString()) : now.toISOString()
    )
  };

  await sbFetch(`kintai?id=eq.${current.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      check_in: nextPayload.check_in,
      check_out: nextPayload.check_out,
      checkin_at: nextPayload.checkin_at,
      checkout_at: nextPayload.checkout_at,
      work_hours: nextPayload.work_hours
    })
  });
}

async function init() {
  if (!appEl) return;

  const queryToken = getQueryParam('token');
  const queryDevice = getQueryParam('device');

  const session = getSession();
  const deviceId = getDeviceId();

  let user = null;

  if (queryToken) {
    user = await loadUserByToken(queryToken, queryDevice || deviceId);
    if (user) {
      setSession({ name: user.name, token: user.token, deviceId: user.device_id || deviceId });
    }
  }

  if (!user && session && session.name && session.token) {
    user = await loadUserByToken(session.token, session.deviceId || deviceId);
  }

  if (!user) {
    renderEmptyState('登録済みの端末ではありません。初回登録を行ってください。');
    return;
  }

  renderApp(user);
}

init();
