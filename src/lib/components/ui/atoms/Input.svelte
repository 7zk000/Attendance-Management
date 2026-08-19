<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes & {
		isError?: boolean;
	};

	let { isError = false, class: className = '', value = $bindable(), ...rest }: Props = $props();
</script>

<input
	class="relative min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground outline-offset-2 outline-ring transition-colors placeholder:text-muted-foreground focus-visible:outline-2 {isError
		? 'border-destructive'
		: 'border-input'} {className}"
	bind:value
	{...rest}
/>
