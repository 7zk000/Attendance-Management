<script lang="ts">
	import Button from '$lib/components/ui/atoms/Button.svelte';
	import Card from '$lib/components/ui/atoms/Card.svelte';
	import Input from '$lib/components/ui/atoms/Input.svelte';
	import Label from '$lib/components/ui/atoms/Label.svelte';
	import Toast from '$lib/components/ui/items/Toast.svelte';
	import { registerUser, upsertUserDevice } from '$lib/api';
	import { generateToken, getDeviceId, setSession } from '$lib/session';

	let name = $state('');
	let resultUrl = $state('');
	let registering = $state(false);

	let toast = $state<{ isOpen: boolean; message: string; variant: 'success' | 'danger' }>({
		isOpen: false,
		message: '',
		variant: 'danger'
	});

	function showToast(message: string, variant: 'success' | 'danger' = 'danger') {
		toast = { isOpen: true, message, variant };
	}

	async function register() {
		const trimmedName = name.trim();
		if (!trimmedName) {
			showToast('名前を入力してください');
			return;
		}

		registering = true;
		const deviceId = getDeviceId();
		const newToken = generateToken();

		try {
			const user = await registerUser(trimmedName, newToken, deviceId);
			if (!user) {
				showToast('登録に失敗しました');
				return;
			}

			try {
				await upsertUserDevice(user.token, deviceId);
			} catch (error) {
				console.warn('Optional user device registration failed:', error);
			}

			setSession({ name: user.name, token: user.token });
			resultUrl = `${window.location.origin}/?token=${user.token}&device=${encodeURIComponent(deviceId)}`;
		} catch (error) {
			console.error('register_user failed:', error);
			showToast('登録に失敗しました。しばらくしてから再度お試しください。');
		} finally {
			registering = false;
		}
	}

	async function copyUrl() {
		await navigator.clipboard.writeText(resultUrl);
		showToast('コピーしました！', 'success');
	}
</script>

<svelte:head>
	<title>勤怠 - ユーザー登録</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4 py-10">
	<Card class="w-full max-w-sm">
		<h1 class="text-xl font-bold text-foreground">勤怠打刻</h1>
		<p class="text-sm leading-relaxed text-muted-foreground">
			名前を入力して登録すると<br />あなた専用のURLが発行されます。
		</p>

		{#if !resultUrl}
			<div class="space-y-3">
				<div>
					<Label for="name-input">名前</Label>
					<Input id="name-input" type="text" placeholder="例: 若山直樹" bind:value={name} />
				</div>
				<Button block onclick={register} disabled={registering}>
					{registering ? '登録中...' : '登録 / URLを確認する'}
				</Button>
			</div>
		{:else}
			<div class="space-y-3">
				<div class="text-xs text-muted-foreground">あなた専用のURLはこちらです</div>
				<div class="glass-panel rounded-xl border border-input bg-surface px-3 py-2.5 text-sm break-all text-primary">
					{resultUrl}
				</div>
				<Button block variant="secondary" onclick={copyUrl}>URLをコピーする</Button>
				<p class="text-xs leading-relaxed text-muted-foreground">
					このURLをホーム画面に追加してください。<br />次回からはこのURLを開くだけでOKです。
				</p>
			</div>
		{/if}
	</Card>
</div>

<div class="fixed top-4 right-4 left-4 z-[60] flex justify-center sm:left-auto sm:justify-end">
	<Toast bind:isOpen={toast.isOpen} variant={toast.variant} class="w-full max-w-sm">
		{toast.message}
	</Toast>
</div>
