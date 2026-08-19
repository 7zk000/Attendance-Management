<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	type Props = HTMLLabelAttributes & {
		children: Snippet;
	};

	let { class: className = '', children, ...rest }: Props = $props();
</script>

<label class="mb-1.5 block text-xs text-muted-foreground {className}" {...rest}>
	{@render children()}
</label>
