<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import X from '@lucide/svelte/icons/x';

	type Props = {
		isOpen?: boolean;
		dismissible?: boolean;
		hideCloseButton?: boolean;
		class?: string;
		children: Snippet;
	};

	let {
		isOpen = $bindable(false),
		dismissible = true,
		hideCloseButton = false,
		class: className = '',
		children
	}: Props = $props();

	function close() {
		if (dismissible) isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/70"
			transition:fade={{ duration: 150 }}
			onclick={close}
			role="presentation"
		></div>
		<div
			class="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/40 {className}"
			transition:scale={{ start: 0.96, duration: 150 }}
			role="dialog"
			aria-modal="true"
		>
			{#if !hideCloseButton}
				<button
					type="button"
					class="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
					onclick={close}
					aria-label="閉じる"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
			{@render children()}
		</div>
	</div>
{/if}
