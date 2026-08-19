<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLTableCellElement> & {
		size?: 'small' | 'medium' | 'large';
		children: Snippet;
	};

	const sizeClasses = { small: 'h-9', medium: 'h-11', large: 'h-13' } as const;

	let { size = 'medium', class: className = '', children, ...rest }: Props = $props();
</script>

<td
	class="border-b border-border/70 px-3 whitespace-nowrap text-foreground {sizeClasses[size]} {className}"
	{...rest}
>
	{@render children()}
</td>
