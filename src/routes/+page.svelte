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
	import WorkDetailsFields from '$lib/components/ui/items/WorkDetailsFields.svelte';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import {
		buildMonthCsv,
		buildTimeOptions,
		countedWorkHours,
		downloadCsv,
		formatYmd,
		getBusinessDayStats,
		getMonthLabel,
		getReasonOptions,
		getTodayLabel,
		isMissingCheckout,
		lastUsedValue,
		NO_TIME_REASONS,
		resolveReasonWorkHours,
		toDateInputValue,
		toTimestamp,
		WORK_TYPE_REASONS,
		type KintaiRecord
	} from '$lib/kintai-utils';
	import {
		deleteKintai,
		fixKintai,
		getActiveRecord,
		getCurrentMonthRecords,
		getRecordForDate,
		loadUserByToken,
		stampKintai,
		type KintaiUser
	} from '$lib/api';
	import { getSession, setSession } from '$lib/session';

	const today = new Date();
	const businessDays = getBusinessDayStats(today.getFullYear(), today.getMonth() + 1);
	const fixReasonOptions = getReasonOptions().map((label) => ({ label, value: label }));
	const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

	let loading = $state(true);
	let notFound = $state(false);
	let user = $state<KintaiUser | null>(null);
	let todayRecord = $state<KintaiRecord | null>(null);
	let monthRecords = $state<KintaiRecord[]>([]);

	let attendanceKindValue = $state('日勤');
	let locationValue = $state('');
	let taskTypeValue = $state('');

	let fixOpen = $state(false);
	let fixLoading = $state(false);
	let fixDate = $state(toDateInputValue(new Date()));
	let fixReason = $state(getReasonOptions()[0]);
	let fixCheckin = $state('09:00');
	let fixCheckout = $state('18:00');
	let fixLocation = $state('');
	let fixTaskType = $state('');
	let fixExisting = $state<KintaiRecord | null>(null);
	let fixRequestId = 0;

	let deleteOpen = $state(false);
	let deleteDate = $state('');
	let deleting = $state(false);

	let toast = $state<{ isOpen: boolean; message: string; variant: 'success' | 'danger' | 'warning' }>({
		isOpen: false,
		message: '',
		variant: 'success'
	});

	function showToast(message: string, variant: 'success' | 'danger' | 'warning' = 'success') {
		toast = { isOpen: true, message, variant };
	}

	// 病欠・有給・私用のため・自社用のためは出勤/退勤を経由せず、
	// 「確定する」一回の操作でその日の記録を完了させる(check_in/check_outはnullのまま)。
	// そのため、この種の理由は todayRecord.remarks が付いた時点で「完了」とみなす。
	let isNoTimeCompleted = $derived(
		Boolean(todayRecord?.remarks) && NO_TIME_REASONS.includes(todayRecord?.remarks ?? '')
	);
	let isCheckout = $derived(Boolean(todayRecord?.check_in));
	let isComplete = $derived(Boolean(todayRecord?.check_out) || isNoTimeCompleted);
	let actionKind = $derived<'checkin' | 'checkout'>(isCheckout ? 'checkout' : 'checkin');
	let reasonOptions = $derived(getReasonOptions());
	let isGroupCReason = $derived(NO_TIME_REASONS.includes(attendanceKindValue));
	let fixNoTimeRequired = $derived(NO_TIME_REASONS.includes(fixReason));
	let fixShowWorkDetails = $derived(WORK_TYPE_REASONS.includes(fixReason));

	// 場所・作業内容は実際に働く日(日勤・夜勤・午前休・午後休)だけの入力項目。
	// 退勤時は理由を選び直さないので、出勤時に記録した理由で判定する。
	let showWorkDetails = $derived(
		WORK_TYPE_REASONS.includes((isCheckout ? todayRecord?.remarks : attendanceKindValue) ?? '')
	);

	let displayTime = $state('');
	let timeOptions = $derived(buildTimeOptions(displayTime));
	let fixCheckinOptions = $derived(buildTimeOptions(fixCheckin));
	let fixCheckoutOptions = $derived([{ label: '--:--(未入力)', value: '' }, ...buildTimeOptions(fixCheckout)]);

	let totalHours = $derived(monthRecords.reduce((sum, row) => sum + countedWorkHours(row), 0));
	let totalWorkDays = $derived(monthRecords.filter((row) => countedWorkHours(row) > 0).length);
	let averageHours = $derived(totalWorkDays > 0 ? totalHours / totalWorkDays : 0);

	// 退勤し忘れた日(いま勤務中の記録は除く)。
	let missingCheckoutDates = $derived(
		monthRecords.filter((row) => isMissingCheckout(row) && row.date !== todayRecord?.date).map((row) => row.date)
	);

	$effect(() => {
		const options = reasonOptions;
		attendanceKindValue =
			todayRecord?.remarks && options.includes(todayRecord.remarks) ? todayRecord.remarks : options[0];
	});

	// 記録済みならその値、まだなら前回使った場所・作業内容を初期値にする。
	$effect(() => {
		locationValue = todayRecord ? (todayRecord.location ?? '') : lastUsedValue(monthRecords, 'location');
		taskTypeValue = todayRecord ? (todayRecord.task_type ?? '') : lastUsedValue(monthRecords, 'task_type');
	});

	// The big time readout doubles as an input, so it can be set directly
	// (e.g. entering a check-in time after arriving late/forgetting to punch)
	// without going through the fix modal.
	$effect(() => {
		displayTime = (isCheckout ? todayRecord?.check_out : todayRecord?.check_in) || '';
	});

	async function refresh() {
		if (!user) return;
		const [records, active] = await Promise.all([
			getCurrentMonthRecords(user.name),
			getActiveRecord(user.name)
		]);
		monthRecords = records;
		todayRecord = active;
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

	async function handleConfirmNoTimeDay() {
		if (!user) return;
		const reason = attendanceKindValue;

		await fixKintai({
			token: user.token,
			date: toDateInputValue(new Date()),
			checkIn: null,
			checkOut: null,
			checkinAt: null,
			checkoutAt: null,
			workHours: resolveReasonWorkHours(reason, null, null),
			remarks: reason,
			location: null,
			taskType: null
		});
		await refresh();
	}

	async function handleStamp() {
		if (!user || isComplete) return;

		if (!isCheckout && isGroupCReason) {
			await handleConfirmNoTimeDay();
			return;
		}

		const now = new Date();
		const time = now.toTimeString().slice(0, 5);
		const kind = actionKind;
		// 退勤時は理由を選び直さない。出勤時に決めた理由(remarks)をそのまま使う。
		const reason = kind === 'checkin' ? attendanceKindValue : todayRecord?.remarks || '日勤';

		// 稼働時間は"HH:MM"同士で計算する(夜勤の日またぎ・Excel側の計算と揃えるため)。
		const workHours = kind === 'checkout' ? resolveReasonWorkHours(reason, todayRecord?.check_in, time) : 0;

		await stampKintai({
			token: user.token,
			kind,
			time,
			at: now.toISOString(),
			workHours,
			remarks: reason,
			location: showWorkDetails ? locationValue || null : null,
			taskType: showWorkDetails ? taskTypeValue || null : null
		});
		await refresh();
	}

	async function handleInlineTimeChange(value: string) {
		if (!user || !value) return;
		const kind = actionKind;
		const date = todayRecord?.date || toDateInputValue(new Date());
		// 退勤時は理由を選び直さない。出勤時に決めた理由(remarks)をそのまま使う。
		const reason = kind === 'checkin' ? attendanceKindValue : todayRecord?.remarks || '日勤';

		const checkIn = kind === 'checkin' ? value : (todayRecord?.check_in ?? null);
		const checkOut = kind === 'checkout' ? value : (todayRecord?.check_out ?? null);
		const checkinAt = kind === 'checkin' ? toTimestamp(date, value) : (todayRecord?.checkin_at ?? null);
		const checkoutAt = kind === 'checkout' ? toTimestamp(date, value, checkIn) : (todayRecord?.checkout_at ?? null);

		await fixKintai({
			token: user.token,
			date,
			checkIn,
			checkOut,
			checkinAt,
			checkoutAt,
			workHours: resolveReasonWorkHours(reason, checkIn, checkOut),
			remarks: reason,
			location: showWorkDetails ? locationValue || null : null,
			taskType: showWorkDetails ? taskTypeValue || null : null
		});

		showToast('時刻を更新しました', 'success');
		await refresh();
	}

	// 修正モーダルは選んだ日付の記録を読み込んで、その内容を編集する。
	async function loadFixRecord(date: string) {
		if (!user || !date) return;
		const requestId = ++fixRequestId;
		fixLoading = true;
		try {
			const record = await getRecordForDate(user.name, date);
			if (requestId !== fixRequestId) return;
			fixExisting = record;
			fixReason = record?.remarks && getReasonOptions().includes(record.remarks) ? record.remarks : '日勤';
			fixCheckin = record?.check_in || '09:00';
			fixCheckout = record ? record.check_out || '' : '18:00';
			fixLocation = record ? (record.location ?? '') : lastUsedValue(monthRecords, 'location');
			fixTaskType = record ? (record.task_type ?? '') : lastUsedValue(monthRecords, 'task_type');
		} catch (error) {
			console.error('getRecordForDate failed:', error);
			showToast('記録の読み込みに失敗しました', 'danger');
		} finally {
			if (requestId === fixRequestId) fixLoading = false;
		}
	}

	function openFix(date?: string) {
		// A night shift's active record may still be filed under yesterday's date
		// once it rolls past midnight, so default the fix modal to that date.
		fixDate = date || todayRecord?.date || toDateInputValue(new Date());
		fixOpen = true;
		loadFixRecord(fixDate);
	}

	async function submitFix() {
		if (!user || fixLoading) return;
		if (!fixDate || (!fixNoTimeRequired && !fixCheckin)) {
			showToast('日付と出勤時間を入力してください', 'danger');
			return;
		}

		const checkIn = fixNoTimeRequired ? null : fixCheckin;
		const checkOut = fixNoTimeRequired ? null : fixCheckout || null;
		// 時刻を変えていなければ、打刻した正確なタイムスタンプを残す。
		const checkinAt = !checkIn
			? null
			: fixExisting?.check_in === checkIn && fixExisting.checkin_at
				? fixExisting.checkin_at
				: toTimestamp(fixDate, checkIn);
		const checkoutAt = !checkOut
			? null
			: fixExisting?.check_out === checkOut && fixExisting.checkout_at
				? fixExisting.checkout_at
				: toTimestamp(fixDate, checkOut, checkIn);

		try {
			await fixKintai({
				token: user.token,
				date: fixDate,
				checkIn,
				checkOut,
				checkinAt,
				checkoutAt,
				workHours: resolveReasonWorkHours(fixReason, checkIn, checkOut),
				remarks: fixReason,
				location: fixShowWorkDetails ? fixLocation || null : null,
				taskType: fixShowWorkDetails ? fixTaskType || null : null
			});
		} catch (error) {
			console.error('fix_kintai failed:', error);
			showToast('修正に失敗しました', 'danger');
			return;
		}

		showToast('修正しました', 'success');
		fixOpen = false;
		await refresh();
	}

	// Deleting is irreversible, so both entry points (the history list and the
	// fix modal) route through the same confirmation step.
	function askDelete(date: string) {
		deleteDate = date;
		fixOpen = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!user || !deleteDate) return;

		deleting = true;
		try {
			const deleted = await deleteKintai({ token: user.token, date: deleteDate });
			if (deleted > 0) {
				showToast('削除しました', 'success');
			} else {
				showToast('その日のデータはありませんでした', 'warning');
			}
			deleteOpen = false;
			await refresh();
		} catch (error) {
			console.error('delete_kintai failed:', error);
			showToast('削除に失敗しました', 'danger');
		} finally {
			deleting = false;
		}
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

	function workDetailsLabel(row: KintaiRecord) {
		return [row.location, row.task_type].filter(Boolean).join(' ');
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

		{#if missingCheckoutDates.length}
			<Card class="border-warning/50 bg-warning/10">
				<div class="text-sm font-semibold text-foreground">退勤が未入力の日があります</div>
				<p class="text-xs text-muted-foreground">日付を押して退勤時間を入力してください。</p>
				<div class="flex flex-wrap gap-2">
					{#each missingCheckoutDates as date (date)}
						<Button size="small" variant="warning" onclick={() => openFix(date)}>
							{historyDateLabel(date)}
						</Button>
					{/each}
				</div>
			</Card>
		{/if}

		<Card>
			{#if isNoTimeCompleted}
				<div class="flex items-center justify-between">
					<div class="text-xs font-medium text-muted-foreground">本日の記録</div>
					<div class="text-xs text-muted-foreground">{toDateInputValue(new Date())}</div>
				</div>
				<div class="text-4xl font-bold text-muted-foreground">{todayRecord?.remarks}</div>
				<Button block size="large" variant="success" disabled>確定済み</Button>
				<Button block variant="secondary" onclick={() => openFix()}>記録を修正する</Button>
			{:else}
				<div class="flex items-center justify-between">
					<div class="text-xs font-medium text-muted-foreground">{isCheckout ? '退勤' : '出勤'}</div>
					<div class="text-xs text-muted-foreground">{toDateInputValue(new Date())}</div>
				</div>
				<!-- 休み(時刻を記録しない理由)を選んでいる間は時刻欄を出さない -->
				{#if isCheckout || !isGroupCReason}
					<Select
						options={timeOptions}
						bind:value={displayTime}
						placeholder="--:--"
						onChange={handleInlineTimeChange}
						class="h-auto min-h-[4.5rem] px-4 text-center !text-4xl font-bold {isComplete
							? 'text-muted-foreground'
							: 'text-foreground'}"
					/>
				{/if}
				{#if !isCheckout}
					<Select
						options={reasonOptions.map((label) => ({ label, value: label }))}
						bind:value={attendanceKindValue}
					/>
				{:else}
					<div class="text-xs text-muted-foreground">理由: {todayRecord?.remarks || '-'}</div>
				{/if}
				{#if showWorkDetails}
					{#if isComplete}
						<div class="text-xs text-muted-foreground">
							場所・作業内容: {(todayRecord && workDetailsLabel(todayRecord)) || '未選択'}
						</div>
					{:else}
						<WorkDetailsFields bind:location={locationValue} bind:taskType={taskTypeValue} />
					{/if}
				{/if}
				<Button
					block
					size="large"
					variant={isCheckout ? 'warning' : 'success'}
					disabled={isComplete}
					onclick={handleStamp}
				>
					{isComplete ? '退勤済み' : isCheckout ? '退勤する' : isGroupCReason ? '確定する' : '出勤する'}
				</Button>
				<Button block variant="secondary" onclick={() => openFix()}>記録を修正する</Button>
			{/if}
		</Card>

		<Card>
			<h2 class="text-sm font-semibold text-foreground">{getMonthLabel()}</h2>
			{#if monthRecords.length === 0}
				<div class="py-6 text-center text-sm text-muted-foreground">まだデータがありません</div>
			{:else}
				<div class="divide-y divide-border">
					{#each monthRecords as row (row.date)}
						<div class="flex items-center justify-between gap-3 py-3">
							<button
								type="button"
								class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left outline-offset-2 outline-ring focus-visible:outline-2"
								onclick={() => openFix(row.date)}
								aria-label="{historyDateLabel(row.date)}の記録を修正"
							>
								<div class="w-16 shrink-0 text-sm font-medium text-foreground">{historyDateLabel(row.date)}</div>
								<div class="min-w-0 flex-1 text-center text-sm text-muted-foreground">
									{#if NO_TIME_REASONS.includes(row.remarks ?? '')}
										<div>{row.remarks}</div>
									{:else}
										<div>
											{row.check_in || '--:--'} →
											<span
												class={isMissingCheckout(row) && row.date !== todayRecord?.date
													? 'font-semibold text-warning'
													: ''}>{row.check_out || '--:--'}</span
											>
										</div>
										<div class="mt-0.5 truncate text-xs text-muted-foreground/70">
											{row.remarks || '出勤'}{workDetailsLabel(row) ? ` / ${workDetailsLabel(row)}` : ''}
										</div>
									{/if}
								</div>
								<div class="w-12 shrink-0 text-right text-sm font-semibold text-success">
									{countedWorkHours(row).toFixed(1)}h
								</div>
							</button>
							<button
								type="button"
								class="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground outline-offset-2 outline-ring transition-colors hover:bg-destructive/15 hover:text-destructive focus-visible:outline-2"
								onclick={() => askDelete(row.date)}
								aria-label="{historyDateLabel(row.date)}のデータを削除"
							>
								<Trash2 class="h-4 w-4" />
							</button>
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
			<Input id="fix-date" type="date" bind:value={fixDate} onchange={() => loadFixRecord(fixDate)} />
			<p class="mt-1 text-xs text-muted-foreground">
				{fixLoading ? '読み込み中...' : fixExisting ? 'この日の記録を修正します' : 'この日の記録はまだありません(新規作成)'}
			</p>
		</div>
		<div>
			<Label for="fix-reason">理由</Label>
			<Select id="fix-reason" options={fixReasonOptions} bind:value={fixReason} disabled={fixLoading} />
		</div>
		{#if !fixNoTimeRequired}
			<div>
				<Label for="fix-checkin">出勤時間</Label>
				<Select id="fix-checkin" options={fixCheckinOptions} bind:value={fixCheckin} disabled={fixLoading} />
			</div>
			<div>
				<Label for="fix-checkout">退勤時間</Label>
				<Select id="fix-checkout" options={fixCheckoutOptions} bind:value={fixCheckout} disabled={fixLoading} />
			</div>
		{/if}
		{#if fixShowWorkDetails}
			<div class="space-y-2">
				<Label>場所・作業内容</Label>
				<WorkDetailsFields bind:location={fixLocation} bind:taskType={fixTaskType} />
			</div>
		{/if}
		<Button block disabled={fixLoading} onclick={submitFix}>修正を送信</Button>
		{#if fixExisting}
			<Button block variant="danger" disabled={fixLoading} onclick={() => askDelete(fixDate)}>
				この日の記録を削除
			</Button>
		{/if}
		<Button block variant="secondary" onclick={() => (fixOpen = false)}>キャンセル</Button>
	</div>
</Modal>

<Modal bind:isOpen={deleteOpen}>
	<div class="space-y-3">
		<h2 class="text-sm font-semibold text-foreground">勤怠データの削除</h2>
		<p class="text-sm leading-relaxed text-muted-foreground">
			{formatYmd(deleteDate)} のデータを削除します。<br />この操作は取り消せません。
		</p>
		<Button block variant="danger" disabled={deleting} onclick={confirmDelete}>
			{deleting ? '削除中...' : '削除する'}
		</Button>
		<Button block variant="secondary" disabled={deleting} onclick={() => (deleteOpen = false)}>
			キャンセル
		</Button>
	</div>
</Modal>

<div class="fixed top-4 right-4 left-4 z-[60] flex justify-center sm:left-auto sm:justify-end">
	<Toast bind:isOpen={toast.isOpen} variant={toast.variant} class="w-full max-w-sm">
		{toast.message}
	</Toast>
</div>
