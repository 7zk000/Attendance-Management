export type KintaiSession = {
	name: string;
	token: string;
};

const SESSION_KEY = 'kintai_session';
const ADMIN_LOGIN_KEY = 'kintai_admin_logged_in';

export function getSession(): KintaiSession | null {
	if (typeof localStorage === 'undefined') return null;
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function setSession(session: KintaiSession) {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getDeviceId(): string {
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
		deviceId = btoa(encodeURIComponent(raw))
			.replace(/=+$/g, '')
			.slice(0, 32);
		localStorage.setItem(key, deviceId);
	}
	return deviceId;
}

export function generateToken(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let token = '';
	for (let i = 0; i < 16; i++) token += chars[Math.floor(Math.random() * chars.length)];
	return token;
}

export function isAdminLoggedIn(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	return sessionStorage.getItem(ADMIN_LOGIN_KEY) === 'true';
}

export function setAdminLoggedIn(state: boolean) {
	sessionStorage.setItem(ADMIN_LOGIN_KEY, state ? 'true' : 'false');
}
