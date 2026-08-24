<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div
	class="glass-panel flex flex-col gap-3 rounded-[28px] border border-border bg-surface p-5 shadow-[inset_0_1px_0_0_rgb(255_255_255_/_10%),0_8px_30px_-8px_rgb(0_0_0_/_50%)] {className}"
	{...rest}
>
	{@render children()}
</div>
