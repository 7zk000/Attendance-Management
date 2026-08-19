<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLTableElement> & { children: Snippet };
	let { class: className = '', children, ...rest }: Props = $props();
</script>

<div class="overflow-x-auto">
	<table class="w-full text-left text-sm {className}" {...rest}>
		{@render children()}
	</table>
</div>
