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
		case '有給':
			return 9;
		case '午前休':
		case '午後休':
			return 4.5;
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
export function getReasonOptions(): string[] {
	return ['日勤', '夜勤', '病欠', '有給', '午前休', '午後休', '私用のため', '自社用のため'];
}

export function getLocationOptions(): string[] {
	return ['【多摩】', '【自宅】'];
}

export function getTaskTypeOptions(): string[] {
	return ['作業', 'ドキュメント整理・手順作成など'];
}

export function buildTimeOptions(): { label: string; value: string }[] {
	const options: { label: string; value: string }[] = [];
	for (let h = 0; h < 24; h++) {
		for (const m of [0, 30]) {
			const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
			options.push({ label: val, value: val });
		}
	}
	return options;
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

export function calcBusinessDays(): { total: number; remaining: number } {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	const totalDays = new Date(year, month + 1, 0).getDate();
	let total = 0;
	let remaining = 0;

	for (let day = 1; day <= totalDays; day++) {
		const date = new Date(year, month, day);
		const isWeekend = date.getDay() === 0 || date.getDay() === 6;
		if (isWeekend) continue;
		total += 1;
		if (day >= now.getDate()) remaining += 1;
	}

	return { total, remaining };
}

export function getBusinessDayStats(year: number, month: number): { total: number; remaining: number } {
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

		if (date >= today) {
			remaining += 1;
		}
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
				(Number(row.work_hours) || 0).toFixed(1),
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
