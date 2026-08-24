<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const buttonVariants = cva(
		'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold leading-tight text-sm outline-offset-2 outline-ring transition-all cursor-pointer focus-visible:outline-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]',
		{
			variants: {
				variant: {
					primary:
						'bg-primary/90 text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255_/_25%)] backdrop-blur-md hover:bg-primary',
					secondary:
						'glass-panel border border-input bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255_/_8%)] hover:bg-accent',
					success:
						'bg-success/90 text-success-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255_/_25%)] backdrop-blur-md hover:bg-success',
					warning:
						'bg-warning/90 text-warning-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255_/_25%)] backdrop-blur-md hover:bg-warning',
					danger:
						'bg-destructive/90 text-destructive-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255_/_25%)] backdrop-blur-md hover:bg-destructive'
				},
				size: {
					small: 'h-9 px-3 text-xs',
					medium: 'h-11 px-4',
					large: 'h-14 px-6 text-base rounded-full'
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
