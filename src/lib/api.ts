import { supabase } from './supabase';
import { toDateInputValue, type KintaiRecord } from './kintai-utils';

export type KintaiUser = {
	id: number;
	name: string;
	token: string;
	device_id: string | null;
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
	if (error) throw new Error(error.message);
	return data as T;
}

export async function registerUser(name: string, token: string, deviceId: string): Promise<KintaiUser | null> {
	const rows = unwrap(
		await supabase.rpc('register_user', { p_name: name, p_token: token, p_device_id: deviceId })
	) as KintaiUser[];
	return rows && rows.length ? rows[0] : null;
}

export async function upsertUserDevice(token: string, deviceId: string): Promise<void> {
	unwrap(await supabase.rpc('upsert_user_device', { p_token: token, p_device_id: deviceId }));
}

export async function loadUserByToken(token: string): Promise<KintaiUser | null> {
	if (!token) return null;
	const rows = unwrap(await supabase.rpc('load_user_by_token', { p_token: token })) as KintaiUser[];
	return rows && rows.length ? rows[0] : null;
}

export async function listUserNames(): Promise<string[]> {
	const rows = unwrap(await supabase.rpc('list_user_names', {})) as { name: string }[];
	return [...new Set((rows || []).map((row) => row.name).filter(Boolean))];
}

export async function getRecordForDate(name: string, date: string): Promise<KintaiRecord | null> {
	const rows = unwrap(
		await supabase
			.from('kintai')
			.select('id,name,date,check_in,check_out,checkin_at,checkout_at,work_hours,remarks')
			.eq('name', name)
			.eq('date', date)
	) as KintaiRecord[];
	return rows && rows.length ? rows[0] : null;
}

export async function getTodayRecord(name: string): Promise<KintaiRecord | null> {
	return getRecordForDate(name, toDateInputValue(new Date()));
}

// A night shift (夜勤) checks in before midnight and checks out after it, so
// "today's" record can actually still be filed under yesterday's date once the
// date rolls over. Prefer an unfinished shift (checked in, not yet checked out)
// from today or yesterday over strictly looking up today's row.
export async function getActiveRecord(name: string): Promise<KintaiRecord | null> {
	const today = toDateInputValue(new Date());
	const yesterday = toDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000));

	const rows = unwrap(
		await supabase
			.from('kintai')
			.select('id,name,date,check_in,check_out,checkin_at,checkout_at,work_hours,remarks')
			.eq('name', name)
			.in('date', [yesterday, today])
			.order('date', { ascending: false })
	) as KintaiRecord[];

	if (!rows || !rows.length) return null;

	const openShift = rows.find((row) => row.check_in && !row.check_out);
	if (openShift) return openShift;

	return rows.find((row) => row.date === today) || null;
}

export async function getMonthRecords(name: string, monthStart: string, monthEndExclusive: string): Promise<KintaiRecord[]> {
	const rows = unwrap(
		await supabase
			.from('kintai')
			.select('date,work_hours,check_in,check_out,checkin_at,checkout_at,remarks')
			.eq('name', name)
			.gte('date', monthStart)
			.lt('date', monthEndExclusive)
			.order('date', { ascending: true })
	) as KintaiRecord[];
	return rows || [];
}

export async function getCurrentMonthRecords(name: string): Promise<KintaiRecord[]> {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const start = `${year}-${month}-01`;
	const nextMonth = new Date(year, today.getMonth() + 1, 1);
	return getMonthRecords(name, start, toDateInputValue(nextMonth));
}

export async function stampKintai(params: {
	token: string;
	kind: 'checkin' | 'checkout';
	time: string;
	at: string;
	workHours: number;
	remarks: string;
}): Promise<void> {
	unwrap(
		await supabase.rpc('stamp_kintai', {
			p_token: params.token,
			p_kind: params.kind,
			p_time: params.time,
			p_at: params.at,
			p_work_hours: params.workHours,
			p_remarks: params.remarks
		})
	);
}

export async function fixKintai(params: {
	token: string;
	date: string;
	checkIn: string | null;
	checkOut: string | null;
	checkinAt: string | null;
	checkoutAt: string | null;
	workHours: number;
	remarks: string;
}): Promise<void> {
	unwrap(
		await supabase.rpc('fix_kintai', {
			p_token: params.token,
			p_date: params.date,
			p_check_in: params.checkIn,
			p_check_out: params.checkOut,
			p_checkin_at: params.checkinAt,
			p_checkout_at: params.checkoutAt,
			p_work_hours: params.workHours,
			p_remarks: params.remarks
		})
	);
}
