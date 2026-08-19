<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div
	class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-lg shadow-black/30 {className}"
	{...rest}
>
	{@render children()}
</div>
