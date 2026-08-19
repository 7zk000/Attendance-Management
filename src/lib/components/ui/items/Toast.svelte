<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import X from '@lucide/svelte/icons/x';

	type Props = {
		isOpen?: boolean;
		duration?: number;
		variant?: 'success' | 'danger' | 'warning';
		hideCloseButton?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		isOpen = $bindable(false),
		duration = 3000,
		variant = 'success',
		hideCloseButton = false,
		class: className = '',
		children
	}: Props = $props();

	$effect(() => {
		if (!isOpen) return;
		const timer = setTimeout(() => {
			isOpen = false;
		}, duration);
		return () => clearTimeout(timer);
	});

	const variantClasses = {
		success: 'border-success/40 bg-success/10 text-success',
		danger: 'border-destructive/40 bg-destructive/10 text-destructive',
		warning: 'border-warning/40 bg-warning/10 text-warning'
	} as const;
</script>

{#if isOpen}
	<div
		class="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-black/30 {variantClasses[
			variant
		]} {className}"
		transition:fly={{ y: -12, duration: 200 }}
	>
		<div class="flex-1">{@render children()}</div>
		{#if !hideCloseButton}
			<button
				type="button"
				class="text-current/70 hover:text-current"
				onclick={() => (isOpen = false)}
				aria-label="閉じる"
			>
				<X class="h-4 w-4" />
			</button>
		{/if}
	</div>
{/if}
