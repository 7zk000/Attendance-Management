<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { PUBLIC_ADMIN_ACCESS_TOKEN } from '$env/static/public';
	import Button from '$lib/components/ui/atoms/Button.svelte';
	import Card from '$lib/components/ui/atoms/Card.svelte';
	import Input from '$lib/components/ui/atoms/Input.svelte';
	import Label from '$lib/components/ui/atoms/Label.svelte';
	import Spinner from '$lib/components/ui/atoms/Spinner.svelte';
	import Table from '$lib/components/ui/table/Table.svelte';
	import TableHead from '$lib/components/ui/table/TableHead.svelte';
	import TableData from '$lib/components/ui/table/TableData.svelte';
	import { formatHours, formatRemainingHours, toDateInputValue, getBusinessDayStats } from '$lib/kintai-utils';
	import { getMonthRecords, listUserNames } from '$lib/api';
	import { isAdminLoggedIn, setAdminLoggedIn } from '$lib/session';

	type SummaryRow = {
		name: string;
		totalHours: number;
		workDays: number;
		sickDays: number;
		earlyLeaveDays: number;
		avgHours: number;
		remainingTo200: number;
	};

	function formatMonthInputValue(date: Date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}

	function parseMonthValue(value: string) {
		if (!value) {
			const now = new Date();
			return { year: now.getFullYear(), month: now.getMonth() + 1 };
		}
		const [year, month] = value.split('-').map(Number);
		return { year, month };
	}

	function currentMonthText(value: string) {
		const { year, month } = parseMonthValue(value);
		return `${year}年${String(month).padStart(2, '0')}月`;
	}

	let loggedIn = $state(false);
	let adminToken = $state('');
	let loginError = $state(false);

	let monthValue = $state(formatMonthInputValue(new Date()));
	let businessStats = $state({ total: 0, remaining: 0 });

	let loadingSummary = $state(true);
	let summaryRows = $state<SummaryRow[]>([]);
	let summaryFailed = $state(false);

	let loadingDetail = $state(true);
	let detailRecords = $state<
		{ date: string; check_in: string | null; check_out: string | null; work_hours: number; remarks: string | null }[]
	>([]);
	let detailFailed = $state(false);

	let detailName = $derived($page.url.searchParams.get('name'));

	onMount(() => {
		loggedIn = isAdminLoggedIn();
	});

	function handleLogin() {
		if (adminToken.trim() === PUBLIC_ADMIN_ACCESS_TOKEN) {
			setAdminLoggedIn(true);
			loggedIn = true;
			loginError = false;
			return;
		}
		setAdminLoggedIn(false);
		loginError = true;
	}

	async function loadSummary(value: string) {
		loadingSummary = true;
		summaryFailed = false;
		try {
			const names = await listUserNames();
			const { year, month } = parseMonthValue(value);
			businessStats = getBusinessDayStats(year, month);

			const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
			const monthEnd = toDateInputValue(new Date(year, month, 1));

			const rows: SummaryRow[] = [];
			for (const name of names) {
				const records = await getMonthRecords(name, monthStart, monthEnd);
				const totalHours = records.reduce((sum, r) => sum + (Number(r.work_hours) || 0), 0);
				const workDays = records.filter((r) => Number(r.work_hours) > 0).length;
				const sickDays = records.filter((r) => r.remarks === '病欠').length;
				const earlyLeaveDays = records.filter((r) => r.remarks === '早退').length;
				const avgHours = workDays > 0 ? totalHours / workDays : 0;
				const remainingTo200 = Math.max(0, 200 - totalHours);
				rows.push({ name, totalHours, workDays, sickDays, earlyLeaveDays, avgHours, remainingTo200 });
			}
			summaryRows = rows.sort((a, b) => b.totalHours - a.totalHours);
		} catch (error) {
			console.error(error);
			summaryFailed = true;
		} finally {
			loadingSummary = false;
		}
	}

	async function loadDetail(name: string, value: string) {
		loadingDetail = true;
		detailFailed = false;
		try {
			const { year, month } = parseMonthValue(value);
			const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
			const monthEnd = toDateInputValue(new Date(year, month, 1));
			detailRecords = await getMonthRecords(name, monthStart, monthEnd);
		} catch (error) {
			console.error(error);
			detailFailed = true;
		} finally {
			loadingDetail = false;
		}
	}

	async function refresh() {
		if (!loggedIn) return;
		if (detailName) {
			await loadDetail(detailName, monthValue);
		} else {
			await loadSummary(monthValue);
		}
	}

	$effect(() => {
		loggedIn;
		detailName;
		monthValue;
		refresh();
	});
</script>

<svelte:head>
	<title>勤怠管理</title>
</svelte:head>

{#if !loggedIn}
	<div class="flex min-h-screen items-center justify-center px-4">
		<Card class="w-full max-w-sm">
			<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">管理者ログイン</p>
			<h1 class="text-xl font-bold text-foreground">勤怠管理画面</h1>
			<div>
				<Label for="admin-token">管理者コード</Label>
				<Input
					id="admin-token"
					type="password"
					placeholder="管理者コードを入力"
					bind:value={adminToken}
					onkeydown={(e) => e.key === 'Enter' && handleLogin()}
				/>
			</div>
			<Button block onclick={handleLogin}>ログイン</Button>
			{#if loginError}
				<p class="text-sm text-destructive">管理者コードが違います。</p>
			{/if}
		</Card>
	</div>
{:else}
	<div class="mx-auto max-w-5xl space-y-4 px-4 py-6">
		<header class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">管理画面</p>
				<h1 class="text-xl font-bold text-foreground">ユーザー稼働時間一覧</h1>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<label class="flex items-center gap-2 text-sm text-muted-foreground" for="month-input">
					<span>対象月</span>
					<Input id="month-input" type="month" class="w-auto" bind:value={monthValue} />
				</label>
				<Button variant="secondary" size="small" onclick={() => goto('/')}>打刻画面に戻る</Button>
				<Button size="small" onclick={refresh}>更新</Button>
			</div>
		</header>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">対象月</div>
				<div class="mt-1 text-xl font-bold text-foreground">{currentMonthText(monthValue)}</div>
			</Card>
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">今月の営業日</div>
				<div class="mt-1 text-xl font-bold text-foreground">{businessStats.total}日</div>
			</Card>
			<Card class="p-4">
				<div class="text-xs text-muted-foreground">残りの営業日</div>
				<div class="mt-1 text-xl font-bold text-warning">{businessStats.remaining}日</div>
			</Card>
		</div>

		{#if !detailName}
			<Card>
				<h2 class="text-sm font-semibold text-foreground">稼働時間一覧</h2>
				{#if loadingSummary}
					<Spinner />
				{:else if summaryFailed}
					<div class="py-6 text-center text-sm text-muted-foreground">データの取得に失敗しました。</div>
				{:else if summaryRows.length === 0}
					<div class="py-6 text-center text-sm text-muted-foreground">登録されているユーザーがありません。</div>
				{:else}
					<Table class="min-w-[760px]">
						<thead>
							<tr>
								<TableHead size="small">No</TableHead>
								<TableHead size="small">ユーザ名</TableHead>
								<TableHead size="small">稼働時間</TableHead>
								<TableHead size="small">出勤日数</TableHead>
								<TableHead size="small">病欠数</TableHead>
								<TableHead size="small">早退数</TableHead>
								<TableHead size="small">平均稼働時間</TableHead>
								<TableHead size="small">200hまで残り</TableHead>
								<TableHead size="small">勤怠一覧</TableHead>
							</tr>
						</thead>
						<tbody>
							{#each summaryRows as row, index (row.name)}
								<tr class={row.totalHours > 200 ? 'bg-destructive/10' : ''}>
									<TableData size="small">{index + 1}</TableData>
									<TableData size="small" class="font-medium">{row.name}</TableData>
									<TableData size="small" class={row.totalHours > 200 ? 'font-semibold text-destructive' : ''}
										>{formatHours(row.totalHours)}</TableData
									>
									<TableData size="small">{row.workDays}日</TableData>
									<TableData size="small">{row.sickDays}日</TableData>
									<TableData size="small">{row.earlyLeaveDays}日</TableData>
									<TableData size="small">{formatHours(row.avgHours)}</TableData>
									<TableData size="small">{formatRemainingHours(row.remainingTo200)}</TableData>
									<TableData size="small">
										<Button
											size="small"
											variant="secondary"
											onclick={() => goto(`/manage?name=${encodeURIComponent(row.name)}`)}
										>
											一覧を表示
										</Button>
									</TableData>
								</tr>
							{/each}
						</tbody>
					</Table>
				{/if}
			</Card>
		{:else}
			<Card>
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">個人勤怠</p>
						<h2 class="text-lg font-bold text-foreground">{detailName}の勤怠一覧（{currentMonthText(monthValue)}）</h2>
					</div>
					<Button variant="secondary" size="small" onclick={() => goto('/manage')}>一覧に戻る</Button>
				</div>
				{#if loadingDetail}
					<Spinner />
				{:else if detailFailed}
					<div class="py-6 text-center text-sm text-muted-foreground">データの取得に失敗しました。</div>
				{:else if detailRecords.length === 0}
					<div class="py-6 text-center text-sm text-muted-foreground">この月の勤怠データがありません。</div>
				{:else}
					<Table class="min-w-[480px]">
						<thead>
							<tr>
								<TableHead size="small">日付</TableHead>
								<TableHead size="small">出勤時刻</TableHead>
								<TableHead size="small">退勤時刻</TableHead>
								<TableHead size="small">稼働時間</TableHead>
								<TableHead size="small">理由</TableHead>
							</tr>
						</thead>
						<tbody>
							{#each detailRecords as record (record.date)}
								<tr>
									<TableData size="small">{record.date || '-'}</TableData>
									<TableData size="small">{record.check_in || '--:--'}</TableData>
									<TableData size="small">{record.check_out || '--:--'}</TableData>
									<TableData size="small">{formatHours(record.work_hours)}</TableData>
									<TableData size="small">{record.remarks || '-'}</TableData>
								</tr>
							{/each}
						</tbody>
					</Table>
				{/if}
			</Card>
		{/if}
	</div>
{/if}
