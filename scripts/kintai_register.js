const env = typeof window !== 'undefined' ? window : {};
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PROJECT_URL || '';
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_PUBLIC_KEY || '';
const BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? `${window.location.origin}/`
  : 'https://attendance-management-two-lyart.vercel.app/';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase config missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading this script.');
}

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

function showStatus(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status error';
  el.style.display = 'block';
}

async function upsertUserDevice(userId, deviceId) {
  const rows = await sbFetch(
    `user_devices?user_id=eq.${encodeURIComponent(String(userId))}&device_id=eq.${encodeURIComponent(deviceId)}&select=id`
  );

  if (rows && rows.length > 0) return;

  await sbFetch('user_devices', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ user_id: userId, device_id: deviceId })
  });
}

async function register() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { showStatus('名前を入力してください'); return; }

  const deviceId = getDeviceId();
  const existing = await sbFetch(`users?name=eq.${encodeURIComponent(name)}&select=id,name,token,device_id`);

  let user;
  let token;

  if (existing && existing.length > 0) {
    user = existing[0];
    token = user.token;

    if (!user.device_id) {
      await sbFetch(`users?id=eq.${user.id}`, {
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

    const created = await sbFetch(`users?name=eq.${encodeURIComponent(name)}&token=eq.${encodeURIComponent(token)}&select=id,name,token,device_id`);
    user = created && created.length > 0 ? created[0] : null;
  }

  if (user && user.id) {
    await upsertUserDevice(user.id, deviceId);
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
