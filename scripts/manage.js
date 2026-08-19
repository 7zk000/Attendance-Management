const env = typeof window !== 'undefined' ? window : {};
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLIC_KEY || '';
const ADMIN_ACCESS_TOKEN = env.ADMIN_ACCESS_TOKEN || 'admin';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase config missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading this script.');
}

const loginScreenEl = document.getElementById('admin-login-screen');
const contentEl = document.getElementById('admin-content');
const adminTokenInput = document.getElementById('admin-token');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginError = document.getElementById('admin-login-error');
const monthLabelEl = document.getElementById('month-label');
const businessDaysEl = document.getElementById('business-days');
const remainingBusinessDaysEl = document.getElementById('remaining-business-days');
const loadingEl = document.getElementById('loading');
const tableWrapEl = document.getElementById('table-wrap');
const tbodyEl = document.getElementById('summary-body');
const reloadBtn = document.getElementById('reload-btn');
const monthInputEl = document.getElementById('month-input');
const backToAttendanceBtn = document.getElementById('back-to-attendance-btn');
const summaryCardEl = document.querySelector('.table-card');
const detailEl = document.getElementById('user-detail');
const detailTitleEl = document.getElementById('detail-title');
const detailLoadingEl = document.getElementById('detail-loading');
const detailTableWrapEl = document.getElementById('detail-table-wrap');
const detailBodyEl = document.getElementById('detail-body');
const backToSummaryBtn = document.getElementById('back-to-summary-btn');

function isAdminLoggedIn() {
  return sessionStorage.getItem('kintai_admin_logged_in') === 'true';
}

function setAdminLoggedIn(state) {
  sessionStorage.setItem('kintai_admin_logged_in', state ? 'true' : 'false');
}

function showAdminLogin() {
  loginScreenEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
}

function showAdminContent() {
  loginScreenEl.classList.add('hidden');
  contentEl.classList.remove('hidden');
}

function handleLogin() {
  const input = adminTokenInput.value.trim();
  if (input === ADMIN_ACCESS_TOKEN) {
    setAdminLoggedIn(true);
    showAdminContent();
    adminLoginError.style.display = 'none';
    loadCurrentView();
    return;
  }

  setAdminLoggedIn(false);
  adminLoginError.style.display = 'block';
  adminTokenInput.focus();
}

adminLoginBtn.addEventListener('click', handleLogin);
adminTokenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleLogin();
});

if (isAdminLoggedIn()) {
  showAdminContent();
} else {
  showAdminLogin();
}

function formatMonthInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthFromInput() {
  const value = monthInputEl.value;
  if (!value) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function getCurrentMonthKey() {
  const { year, month } = getMonthFromInput();
  return `${year}/${String(month).padStart(2, '0')}`;
}

function getCurrentMonthText() {
  const { year, month } = getMonthFromInput();
  return `${year}年${String(month).padStart(2, '0')}月`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDetailName() {
  return new URLSearchParams(window.location.search).get('name');
}

function showSummaryView() {
  summaryCardEl.classList.remove('hidden');
  detailEl.classList.add('hidden');
}

function showDetailView() {
  summaryCardEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
}

function getBusinessDayStats(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const targetMonth = month - 1;

  let total = 0;
  let remaining = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, targetMonth, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (isWeekend) continue;

    total += 1;

    const isCurrentMonth = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    if (isCurrentMonth && date >= today) {
      remaining += 1;
    }

    if (!isCurrentMonth && date >= today) {
      remaining += 1;
    }
  }

  return { total, remaining };
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

function formatHours(value) {
  return `${(Number(value) || 0).toFixed(1)} h`;
}

function formatRemainingHours(value) {
  return `${Math.max(0, Number(value) || 0).toFixed(1)} h`;
}

function renderRows(rows) {
  if (!rows.length) {
    tbodyEl.innerHTML = '<tr><td colspan="8" class="empty">登録されているユーザーがありません。</td></tr>';
    return;
  }

  const sorted = [...rows].sort((a, b) => b.totalHours - a.totalHours);

  tbodyEl.innerHTML = sorted.map((row, index) => {
    const overLimit = row.totalHours > 200;
    const rowClass = overLimit ? 'over-limit' : '';

    return `
      <tr class="${rowClass}">
        <td>${index + 1}</td>
        <td>${row.name}</td>
        <td>${formatHours(row.totalHours)}</td>
        <td>${row.workDays}日</td>
        <td>${row.restDays}日</td>
        <td>${formatHours(row.avgHours)}</td>
        <td>${formatRemainingHours(row.remainingTo200)}</td>
        <td>
          <button class="user-detail-button" type="button" aria-label="${escapeHtml(row.name)}の勤怠一覧を表示">一覧を表示</button>
        </td>
      </tr>
    `;
  }).join('');

  tbodyEl.querySelectorAll('.user-detail-button').forEach((button, index) => {
    button.addEventListener('click', () => {
      const selectedRow = sorted[index];
      window.location.href = `manage.html?name=${encodeURIComponent(selectedRow.name)}`;
    });
  });
}

function renderDetailRows(records) {
  if (!records.length) {
    detailBodyEl.innerHTML = '<tr><td colspan="5" class="empty">この月の勤怠データがありません。</td></tr>';
    return;
  }

  detailBodyEl.innerHTML = records.map((record) => `
    <tr>
      <td>${escapeHtml(record.date || '-')}</td>
      <td>${escapeHtml(record.check_in || '--:--')}</td>
      <td>${escapeHtml(record.check_out || '--:--')}</td>
      <td>${formatHours(record.work_hours)}</td>
      <td>${escapeHtml(record.remarks || '-')}</td>
    </tr>
  `).join('');
}

async function loadUserDetail(name) {
  showDetailView();
  detailLoadingEl.classList.remove('hidden');
  detailTableWrapEl.classList.add('hidden');
  detailTitleEl.textContent = `${name}の勤怠一覧（${getCurrentMonthText()}）`;

  try {
    const { year, month } = getMonthFromInput();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1);
    const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const records = await sbFetch(
      `kintai?name=eq.${encodeURIComponent(name)}&date=gte.${encodeURIComponent(monthStart)}&date=lt.${encodeURIComponent(monthEnd)}&select=date,check_in,check_out,work_hours,remarks&order=date.asc`
    );
    renderDetailRows(records || []);
  } catch (error) {
    detailBodyEl.innerHTML = '<tr><td colspan="5" class="empty">データの取得に失敗しました。</td></tr>';
    console.error(error);
  } finally {
    detailLoadingEl.classList.add('hidden');
    detailTableWrapEl.classList.remove('hidden');
  }
}

function loadCurrentView() {
  const detailName = getDetailName();
  if (detailName) {
    loadUserDetail(detailName);
  } else {
    showSummaryView();
    loadUserSummary();
  }
}

async function loadUserSummary() {
  loadingEl.classList.remove('hidden');
  tableWrapEl.classList.add('hidden');

  try {
    const users = await sbFetch('users?select=name');
    const names = [...new Set((users || []).map((user) => user.name).filter(Boolean))];

    const { year, month } = getMonthFromInput();
    const monthKey = `${year}/${String(month).padStart(2, '0')}`;
    const businessStats = getBusinessDayStats(year, month);
    const summary = [];

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1);
    const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    for (const name of names) {
      const records = await sbFetch(
        `kintai?name=eq.${encodeURIComponent(name)}&date=gte.${encodeURIComponent(monthStart)}&date=lt.${encodeURIComponent(monthEnd)}&select=work_hours,date`
      );

      const totalHours = (records || []).reduce((sum, record) => sum + (Number(record.work_hours) || 0), 0);
      const workDays = (records || []).filter((record) => Number(record.work_hours) > 0).length;
      const restDays = Math.max(0, businessStats.total - workDays);
      const avgHours = workDays > 0 ? totalHours / workDays : 0;
      const remainingTo200 = Math.max(0, 200 - totalHours);

      summary.push({
        name,
        totalHours,
        workDays,
        restDays,
        avgHours,
        remainingTo200
      });
    }

    monthLabelEl.textContent = getCurrentMonthText();
    businessDaysEl.textContent = `${businessStats.total}日`;
    remainingBusinessDaysEl.textContent = `${businessStats.remaining}日`;
    renderRows(summary);
  } catch (error) {
    tbodyEl.innerHTML = '<tr><td colspan="8" class="empty">データの取得に失敗しました。</td></tr>';
    console.error(error);
  } finally {
    loadingEl.classList.add('hidden');
    tableWrapEl.classList.remove('hidden');
  }
}

const now = new Date();
monthInputEl.value = formatMonthInputValue(now);
monthInputEl.addEventListener('change', loadCurrentView);
reloadBtn.addEventListener('click', loadCurrentView);
backToAttendanceBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});
backToSummaryBtn.addEventListener('click', () => {
  window.location.href = 'manage.html?view=summary';
});

loadCurrentView();
