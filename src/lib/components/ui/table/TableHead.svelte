<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLTableCellElement> & {
		size?: 'small' | 'medium' | 'large';
		children: Snippet;
	};

	const sizeClasses = { small: 'h-8', medium: 'h-10', large: 'h-12' } as const;

	let { size = 'medium', class: className = '', children, ...rest }: Props = $props();
</script>

<th
	class="border-b border-border px-3 text-xs font-medium whitespace-nowrap text-muted-foreground {sizeClasses[
		size
	]} {className}"
	{...rest}
>
	{@render children()}
</th>
