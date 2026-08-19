<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const buttonVariants = cva(
		'inline-flex items-center justify-center gap-2 rounded-xl font-semibold leading-tight text-sm outline-offset-2 outline-ring transition-colors cursor-pointer focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
		{
			variants: {
				variant: {
					primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
					secondary: 'border border-input bg-secondary text-secondary-foreground hover:bg-accent',
					success: 'bg-success text-success-foreground hover:bg-success/90',
					warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
					danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
				},
				size: {
					small: 'h-9 px-3 text-xs',
					medium: 'h-11 px-4',
					large: 'h-14 px-6 text-base'
				},
				block: {
					true: 'w-full',
					false: ''
				}
			},
			defaultVariants: {
				variant: 'primary',
				size: 'medium',
				block: false
			}
		}
	);
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Props = (HTMLButtonAttributes | HTMLAnchorAttributes) & {
		variant?: VariantProps<typeof buttonVariants>['variant'];
		size?: VariantProps<typeof buttonVariants>['size'];
		block?: boolean;
		href?: string;
		children: Snippet;
	};

	let {
		variant = 'primary',
		size = 'medium',
		block = false,
		href,
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a {href} class={buttonVariants({ variant, size, block, class: className })} {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button class={buttonVariants({ variant, size, block, class: className })} {...rest as HTMLButtonAttributes}>
		{@render children()}
	</button>
{/if}
