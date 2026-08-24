<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	export type SelectOptionItem = { label: string; value: string };

	type Props = Omit<HTMLSelectAttributes, 'size'> & {
		options: SelectOptionItem[];
		value?: string;
		placeholder?: string;
		size?: 'small' | 'medium' | 'large';
		isError?: boolean;
		onChange?: (value: string) => void;
	};

	let {
		options,
		value = $bindable(''),
		placeholder,
		size = 'medium',
		disabled = false,
		isError = false,
		class: className = '',
		onChange,
		...rest
	}: Props = $props();

	const sizeClasses = {
		small: 'h-9 text-xs',
		medium: 'h-11 text-sm',
		large: 'h-14 text-base'
	} as const;

	function handleChange(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		onChange?.(target.value);
	}
</script>

<select
	class="glass-panel w-full rounded-xl border bg-surface px-3 text-foreground outline-offset-2 outline-ring transition-colors focus-visible:outline-2 disabled:opacity-40 {sizeClasses[
		size
	]} {isError ? 'border-destructive' : 'border-input'} {className}"
	{disabled}
	bind:value
	onchange={handleChange}
	{...rest}
>
	{#if placeholder}
		<option value="" disabled hidden>{placeholder}</option>
	{/if}
	{#each options as option (option.value)}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>
