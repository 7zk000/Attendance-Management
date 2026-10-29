export type KintaiRecord = {
	id?: number;
	name?: string;
	date: string;
	check_in: string | null;
	check_out: string | null;
	checkin_at?: string | null;
	checkout_at?: string | null;
	work_hours: number;
	remarks: string | null;
	location?: string | null;
	task_type?: string | null;
};

export function calcWorkHours(checkin: string | null | undefined, checkout: string | null | undefined): number {
	if (!checkin || !checkout) return 0;

	const isTimeOnly = (value: string) => value.includes(':') && value.split(':').length === 2;

	const parseValue = (value: string) => {
		if (!value) return null;
		if (isTimeOnly(value)) {
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

	// "HH:MM"-only values carry no date, so a night shift (e.g. 22:00 -> 06:00)
	// naively diffs negative. Since both values share today's date in that case,
	// treat an end time earlier than the start time as spilling into the next day.
	if (isTimeOnly(checkin) && isTimeOnly(checkout) && end.getTime() < start.getTime()) {
		end.setDate(end.getDate() + 1);
	}

	const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

	// Excel転記スクリプト(app/fill_attendance.py)と同じ休憩ルール:
	// 実働8時間超は一律1時間の休憩を控除する。
	const BREAK_THRESHOLD_HOURS = 8;
	const BREAK_HOURS = 1;
	const workHours = diffHours > BREAK_THRESHOLD_HOURS ? diffHours - BREAK_HOURS : diffHours;

	return Math.max(0, workHours);
}

// 実際に働く日(場所・作業内容の入力欄を表示する対象)。
export const WORK_TYPE_REASONS = ['日勤', '夜勤', '午前休', '午後休'];

// 時刻の記録が不要な休み(出勤/退勤の代わりに「確定する」で即日完了する)。
export const NO_TIME_REASONS = ['病欠', '有給', '私用のため', '自社用のため'];

export function resolveReasonWorkHours(
	reason: string,
	checkinValue: string | null | undefined,
	checkoutValue: string | null | undefined
): number {
	switch (reason) {
		// 休みの日は稼働時間に含めない(Excelでも時刻を書かないため稼働扱いにならない)。
		// 午前休・午後休は実際に働いた時刻から計算する(Excelと同じ)。
		case '有給':
		case '病欠':
		case '私用のため':
		case '自社用のため':
			return 0;
		default:
			return calcWorkHours(checkinValue, checkoutValue);
	}
}

// 出勤時に選べる理由の一覧。退勤時は理由を選ばない(remarksは出勤時の値を
// そのまま保持する)ため、打刻修正モーダルもこの一覧を共用する。
// 集計・表示用の稼働時間。以前は有給に9hを記録していたため、保存済みの値に
// 関わらず休みの日は0として扱う。
export function countedWorkHours(record: Pick<KintaiRecord, 'work_hours' | 'remarks'>): number {
	if (NO_TIME_REASONS.includes(record.remarks ?? '')) return 0;
	return Number(record.work_hours) || 0;
}

// 退勤が入っていない(打刻し忘れの)記録か。休みの日は時刻を持たないので対象外。
export function isMissingCheckout(record: Pick<KintaiRecord, 'check_in' | 'check_out'>): boolean {
	return Boolean(record.check_in) && !record.check_out;
}

// "YYYY-MM-DD" と "HH:MM" からタイムスタンプ(ISO)を作る。afterTime より前(同時刻含む)の
// 時刻は日をまたいだ夜勤の退勤とみなして翌日扱いにする。
export function toTimestamp(date: string, time: string, afterTime?: string | null): string {
	const value = new Date(`${date}T${time}:00`);
	if (afterTime && time <= afterTime) value.setDate(value.getDate() + 1);
	return value.toISOString();
}

// 最後に使った場所・作業内容を、次の入力の初期値にする。
export function lastUsedValue(records: KintaiRecord[], key: 'location' | 'task_type'): string {
	for (let i = records.length - 1; i >= 0; i--) {
		const value = records[i][key];
		if (value) return value;
	}
	return '';
}

export function getReasonOptions(): string[] {
	return ['日勤', '夜勤', '病欠', '有給', '午前休', '午後休', '私用のため', '自社用のため'];
}

export function getLocationOptions(): string[] {
	return ['【多摩】', '【自宅】'];
}

export function getTaskTypeOptions(): string[] {
	return ['作業', 'ドキュメント整理・手順作成など'];
}

// 30分刻みの選択肢。打刻した時刻(例: 08:53)が刻みに無いとSelectが空表示に
// なるため、extra に渡した時刻も選択肢に含める。
export function buildTimeOptions(extra?: string | null): { label: string; value: string }[] {
	const values: string[] = [];
	for (let h = 0; h < 24; h++) {
		for (const m of [0, 30]) {
			values.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
		}
	}
	if (extra && !values.includes(extra)) {
		values.push(extra);
		values.sort();
	}
	return values.map((value) => ({ label: value, value }));
}

export function toDateInputValue(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function formatYmd(value: string | null | undefined): string {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

export function getTodayLabel(): string {
	const now = new Date();
	const days = ['日', '月', '火', '水', '木', '金', '土'];
	return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} (${days[now.getDay()]})`;
}

export function getMonthLabel(): string {
	const now = new Date();
	return `${now.getMonth() + 1}月の勤務履歴`;
}

const holidayCache = new Map<number, Set<string>>();

// 日本の祝日("M-D"の集合)。振替休日・国民の休日を含む。春分・秋分は1980〜2099年の近似式。
function getJapaneseHolidays(year: number): Set<string> {
	const cached = holidayCache.get(year);
	if (cached) return cached;

	const key = (month: number, day: number) => `${month}-${day}`;
	const nthMonday = (month: number, n: number) => {
		const firstWeekday = new Date(year, month - 1, 1).getDay();
		return ((8 - firstWeekday) % 7) + 1 + (n - 1) * 7;
	};
	const spring = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
	const autumn = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));

	const base = new Set([
		key(1, 1),
		key(1, nthMonday(1, 2)),
		key(2, 11),
		key(2, 23),
		key(3, spring),
		key(4, 29),
		key(5, 3),
		key(5, 4),
		key(5, 5),
		key(7, nthMonday(7, 3)),
		key(8, 11),
		key(9, nthMonday(9, 3)),
		key(9, autumn),
		key(10, nthMonday(10, 2)),
		key(11, 3),
		key(11, 23)
	]);
	const holidays = new Set(base);
	const dateKey = (date: Date) => key(date.getMonth() + 1, date.getDate());

	for (let date = new Date(year, 0, 1); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
		const k = dateKey(date);
		// 振替休日: 日曜の祝日の後、最初の祝日でない日
		if (base.has(k) && date.getDay() === 0) {
			const next = new Date(date);
			do next.setDate(next.getDate() + 1);
			while (base.has(dateKey(next)));
			holidays.add(dateKey(next));
		}
		// 国民の休日: 祝日に挟まれた平日
		if (!base.has(k) && date.getDay() !== 0) {
			const prev = new Date(year, date.getMonth(), date.getDate() - 1);
			const next = new Date(year, date.getMonth(), date.getDate() + 1);
			if (base.has(dateKey(prev)) && base.has(dateKey(next))) holidays.add(k);
		}
	}

	holidayCache.set(year, holidays);
	return holidays;
}

// 指定月の営業日数(土日祝を除く)と、今日を含めた残りの営業日数。
export function getBusinessDayStats(year: number, month: number): { total: number; remaining: number } {
	const daysInMonth = new Date(year, month, 0).getDate();
	const holidays = getJapaneseHolidays(year);
	const today = toDateInputValue(new Date());

	let total = 0;
	let remaining = 0;

	for (let day = 1; day <= daysInMonth; day++) {
		const date = new Date(year, month - 1, day);
		const isWeekend = date.getDay() === 0 || date.getDay() === 6;
		if (isWeekend || holidays.has(`${month}-${day}`)) continue;

		total += 1;
		if (toDateInputValue(date) >= today) remaining += 1;
	}

	return { total, remaining };
}

export function formatHours(value: number | null | undefined): string {
	return `${(Number(value) || 0).toFixed(1)} h`;
}

export function formatRemainingHours(value: number | null | undefined): string {
	return `${Math.max(0, Number(value) || 0).toFixed(1)} h`;
}

function csvEscapeCell(value: unknown): string {
	const str = String(value ?? '');
	return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildMonthCsv(records: KintaiRecord[]): string {
	const header = ['日付', '出勤時刻', '退勤時刻', '稼働時間(h)', '理由', '場所', '作業内容'];
	const lines = [header.map(csvEscapeCell).join(',')];

	records.forEach((row) => {
		lines.push(
			[
				formatYmd(row.date),
				row.check_in || '',
				row.check_out || '',
				countedWorkHours(row).toFixed(1),
				row.remarks || '',
				row.location || '',
				row.task_type || ''
			]
				.map(csvEscapeCell)
				.join(',')
		);
	});

	return '﻿' + lines.join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
	const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
