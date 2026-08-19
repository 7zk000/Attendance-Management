<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/atoms/Button.svelte';
	import Card from '$lib/components/ui/atoms/Card.svelte';
	import Input from '$lib/components/ui/atoms/Input.svelte';
	import Label from '$lib/components/ui/atoms/Label.svelte';
	import Select from '$lib/components/ui/atoms/Select.svelte';
	import Spinner from '$lib/components/ui/atoms/Spinner.svelte';
	import Modal from '$lib/components/ui/modals/Modal.svelte';
	import Toast from '$lib/components/ui/items/Toast.svelte';
	import {
		buildMonthCsv,
		buildTimeOptions,
		calcBusinessDays,
		downloadCsv,
		formatYmd,
		getFixReasonOptions,
		getMonthLabel,
		getReasonOptions,
		getTodayLabel,
		resolveReasonWorkHours,
		toDateInputValue,
		type KintaiRecord
	} from '$lib/kintai-utils';
	import {
		fixKintai,
		getCurrentMonthRecords,
		getRecordForDate,
		getTodayRecord,
		loadUserByToken,
		stampKintai,
		type KintaiUser
	} from '$lib/api';
	import { getSession, setSession } from '$lib/session';

	const businessDays = calcBusinessDays();
	const timeOptions = buildTimeOptions();
	const fixReasonOptions = getFixReasonOptions().map((label) => ({ label, value: label }));
	const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

	let loading = $state(true);
	let notFound = $state(false);
	let user = $state<KintaiUser | null>(null);
	let todayRecord = $state<KintaiRecord | null>(null);
	let monthRecords = $state<KintaiRecord[]>([]);

	let attendanceKindValue = $state('日勤');
	let fixOpen = $state(false);
	let fixDate = $state(toDateInputValue(new Date()));
	let fixReason = $state(getFixReasonOptions()[0]);
	let fixCheckin = $state('09:00');
	let fixCheckout = $state('18:00');

	let toast = $state<{ isOpen: boolean; message: string; variant: 'success' | 'danger' | 'warning' }>({
		isOpen: false,
		message: '',
		variant: 'success'
	});

	function showToast(message: string, variant: 'success' | 'danger' | 'warning' = 'success') {
		toast = { isOpen: true, message, variant };
	}

	let isCheckout = $derived(Boolean(todayRecord?.check_in));
	let isComplete = $derived(Boolean(todayRecord?.check_out));
	let actionKind = $derived<'checkin' | 'checkout'>(isCheckout ? 'checkout' : 'checkin');
	let reasonOptions = $derived(getReasonOptions(actionKind));
	let fixNoTimeRequired = $derived(fixReason === '病欠');

	let totalHours = $derived(monthRecords.reduce((sum, row) => sum + (Number(row.work_hours) || 0), 0));
	let totalWorkDays = $derived(monthRecords.filter((row) => Number(row.work_hours) > 0).length);
	let averageHours = $derived(totalWorkDays > 0 ? totalHours / totalWorkDays : 0);

	$effect(() => {
		const options = reasonOptions;
		attendanceKindValue =
			todayRecord?.remarks && options.includes(todayRecord.remarks) ? todayRecord.remarks : options[0];
	});

	async function refresh() {
		if (!user) return;
		const [records, today] = await Promise.all([
			getCurrentMonthRecords(user.name),
			getTodayRecord(user.name)
		]);
		monthRecords = records;
		todayRecord = today;
		fixDate = toDateInputValue(new Date());
		if (today?.check_in) fixCheckin = today.check_in;
		if (today?.check_out) fixCheckout = today.check_out;
	}

	onMount(async () => {
		const queryToken = new URLSearchParams(window.location.search).get('token');
		const session = getSession();

		let loadedUser: KintaiUser | null = null;

		if (queryToken) {
			loadedUser = await loadUserByToken(queryToken);
			if (loadedUser) {
				setSession({ name: loadedUser.name, token: loadedUser.token });
			}
		}

		if (!loadedUser && session?.name && session?.token) {
			loadedUser = await loadUserByToken(session.token);
		}

		if (!loadedUser) {
			notFound = true;
			loading = false;
			return;
		}

		user = loadedUser;
		await refresh();
		loading = false;
	});

	async function handleStamp() {
		if (!user || isComplete) return;
		const now = new Date();
		const time = now.toTimeString().slice(0, 5);
		const kind = actionKind;
		const reason = attendanceKindValue || (kind === 'checkout' ? '退勤' : '日勤');

		const workHours =
			kind === 'checkout'
				? resolveReasonWorkHours(
						reason,
						todayRecord?.checkin_at || todayRecord?.check_in,
						todayRecord?.checkout_at || now.toISOString()
					)
				: todayRecord?.work_hours || 0;

		await stampKintai({ token: user.token, kind, time, at: now.toISOString(), workHours, remarks: reason });
		await refresh();
	}

	async function submitFix() {
		if (!user) return;
		if (!fixDate || (!fixNoTimeRequired && (!fixCheckin || !fixCheckout))) {
			showToast('日付・出勤・退勤時間を入力してください', 'danger');
			return;
		}

		const existing = await getRecordForDate(user.name, fixDate);
		const workHours = resolveReasonWorkHours(fixReason, fixCheckin, fixCheckout);
		const kind = actionKind;

		const checkIn = fixNoTimeRequired ? null : kind === 'checkin' ? fixCheckin : existing?.check_in || fixCheckin;
		const checkOut = fixNoTimeRequired ? null : kind === 'checkout' ? fixCheckout : existing?.check_out || fixCheckout;
		const checkinAt = fixNoTimeRequired
			? null
			: existing
				? (existing.checkin_at ?? null)
				: kind === 'checkin'
					? new Date(`${fixDate}T${fixCheckin}:00`).toISOString()
					: null;
		const checkoutAt = fixNoTimeRequired
			? null
			: existing
				? (existing.checkout_at ?? null)
				: kind === 'checkout'
					? new Date(`${fixDate}T${fixCheckout}:00`).toISOString()
					: null;

		await fixKintai({
			token: user.token,
			date: fixDate,
			checkIn,
			checkOut,
			checkinAt,
			checkoutAt,
			workHours,
			remarks: fixReason
		});

		showToast('修正しました', 'success');
		fixOpen = false;
		await refresh();
	}

	function handleExportCsv() {
		if (!user || !monthRecords.length) {
			showToast('出力できる履歴がありません', 'danger');
			return;
		}
		const csv = buildMonthCsv(monthRecords);
		const now = new Date();
		const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		downloadCsv(`勤怠_${user.name}_${ym}.csv`, csv);
	}

	function historyDateLabel(dateStr: string) {
		const date = new Date(dateStr);
		return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}(${weekdayNames[date.getDay()]})`;
	}
</script>

<svelte:head>
	<title>勤怠打刻</title>
</svelte:head>

<div class="mx-auto w-full max-w-md space-y-4 px-4 py-6 pb-10">
	{#if loading}
		<Spinner class="pt-16" />
	{:else if notFound}
		<Card class="mt-16 items-center text-center">
			<h1 class="text-lg font-bold text-foreground">勤怠打刻</h1>
			<p class="text-sm leading-relaxed text-muted-foreground">
				登録済みの端末ではありません。初回登録を行ってください。
			</p>
			<Button block href="/register">登録ページへ</Button>
		</Card>
	{:else if user}
		<div class="text-center">
			<h1 class="text-sm font-medium tracking-wide text-muted-foreground">勤怠打刻</h1>
			<div class="mt-1 text-xl font-bold text-foreground">{user.name}</div>
			<div class="mt-1 text-xs text-muted-foreground">{getTodayLabel()}</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">合計稼働時間</div>
				<div class="mt-1">
					<span class="text-2xl font-bold text-success">{totalHours.toFixed(1)}</span>
					<span class="ml-1 text-xs text-muted-foreground">h</span>
				</div>
			</Card>
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">残り営業日</div>
				<div class="mt-1">
					<span class="text-2xl font-bold text-warning">{businessDays.remaining}</span>
					<span class="ml-1 text-xs text-muted-foreground">日</span>
				</div>
			</Card>
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">1日平均稼働時間</div>
				<div class="mt-1">
					<span class="text-2xl font-bold text-foreground">{averageHours.toFixed(1)}</span>
					<span class="ml-1 text-xs text-muted-foreground">h</span>
				</div>
			</Card>
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">今月の営業日数</div>
				<div class="mt-1">
					<span class="text-2xl font-bold text-foreground">{businessDays.total}</span>
					<span class="ml-1 text-xs text-muted-foreground">日</span>
				</div>
			</Card>
		</div>

		<Card>
			<div class="flex items-center justify-between">
				<div class="text-xs font-medium text-muted-foreground">{isCheckout ? '退勤' : '出勤'}</div>
				<div class="text-xs text-muted-foreground">{toDateInputValue(new Date())}</div>
			</div>
			<div class="text-4xl font-bold {isComplete ? 'text-muted-foreground' : 'text-foreground'}">
				{isCheckout ? todayRecord?.check_out || '--:--' : todayRecord?.check_in || '--:--'}
			</div>
			<Select options={reasonOptions.map((label) => ({ label, value: label }))} bind:value={attendanceKindValue} />
			<Button
				block
				size="large"
				variant={isCheckout ? 'warning' : 'success'}
				disabled={isComplete}
				onclick={handleStamp}
			>
				{isComplete ? '退勤済み' : isCheckout ? '退勤する' : '出勤する'}
			</Button>
			<Button block variant="secondary" onclick={() => (fixOpen = true)}>
				{isCheckout ? '退勤時間を修正する' : '出勤時間を修正する'}
			</Button>
		</Card>

		<Card>
			<h2 class="text-sm font-semibold text-foreground">{getMonthLabel()}</h2>
			{#if monthRecords.length === 0}
				<div class="py-6 text-center text-sm text-muted-foreground">まだデータがありません</div>
			{:else}
				<div class="divide-y divide-border">
					{#each monthRecords as row (row.date)}
						<div class="flex items-center justify-between gap-3 py-3">
							<div class="w-16 shrink-0 text-sm font-medium text-foreground">{historyDateLabel(row.date)}</div>
							<div class="min-w-0 flex-1 text-center text-sm text-muted-foreground">
								<div>{row.check_in || '--:--'} → {row.check_out || '--:--'}</div>
								<div class="mt-0.5 text-xs text-muted-foreground/70">理由: {row.remarks || '出勤'}</div>
							</div>
							<div class="w-12 shrink-0 text-right text-sm font-semibold text-success">
								{(Number(row.work_hours) || 0).toFixed(1)}h
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<div class="space-y-2">
			<Button block variant="secondary" onclick={handleExportCsv}>今月の履歴をCSV出力</Button>
			<Button block variant="secondary" href="/manage">管理用画面へ</Button>
		</div>
	{/if}
</div>

<Modal bind:isOpen={fixOpen}>
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-foreground">打刻修正</h2>
		<div>
			<Label for="fix-date">日付</Label>
			<Input id="fix-date" type="date" bind:value={fixDate} />
		</div>
		<div>
			<Label for="fix-reason">理由</Label>
			<Select id="fix-reason" options={fixReasonOptions} bind:value={fixReason} />
		</div>
		{#if !fixNoTimeRequired}
			<div>
				<Label for="fix-checkin">出勤時間</Label>
				<Select id="fix-checkin" options={timeOptions} bind:value={fixCheckin} />
			</div>
			<div>
				<Label for="fix-checkout">退勤時間</Label>
				<Select id="fix-checkout" options={timeOptions} bind:value={fixCheckout} />
			</div>
		{/if}
		<Button block onclick={submitFix}>修正を送信</Button>
		<Button block variant="secondary" onclick={() => (fixOpen = false)}>キャンセル</Button>
	</div>
</Modal>

<div class="fixed top-4 right-4 left-4 z-[60] flex justify-center sm:left-auto sm:justify-end">
	<Toast bind:isOpen={toast.isOpen} variant={toast.variant} class="w-full max-w-sm">
		{toast.message}
	</Toast>
</div>
