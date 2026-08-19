const SUPABASE_URL = 'https://orkwjindnxjkaplsbcdb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_selWw3fEQWrExooHJZTt_w_7OKkA3hQ';
const BASE_URL = 'https://naokstarider2624114-art.github.io/kintai/kintai.html';

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

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function sbFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (res.status === 204) return null;
  return res.json();
}

function showStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status error';
  el.style.display = 'block';
}

async function register() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { showStatus('名前を入力してください'); return; }

  const deviceId = getDeviceId();
  const existing = await sbFetch(`users?name=eq.${encodeURIComponent(name)}&select=id,name,token,device_id`);

  let token;
  if (existing && existing.length > 0) {
    token = existing[0].token;
    if (!existing[0].device_id) {
      await sbFetch(`users?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ device_id: deviceId })
      });
    }
  } else {
    token = generateToken();
    await sbFetch('users', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ name, token, device_id: deviceId })
    });
  }

  localStorage.setItem('kintai_session', JSON.stringify({ name, token, deviceId }));

  const url = `${BASE_URL}?token=${token}&device=${encodeURIComponent(deviceId)}`;
  document.getElementById('url-box').textContent = url;
  document.getElementById('result').style.display = 'block';
  document.getElementById('status').style.display = 'none';
}

function copyUrl() {
  const url = document.getElementById('url-box').textContent;
  navigator.clipboard.writeText(url).then(() => {
    alert('コピーしました！');
  });
}

window.register = register;
window.copyUrl = copyUrl;
