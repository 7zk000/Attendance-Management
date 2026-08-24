<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import BackgroundDots from '$lib/components/ui/atoms/BackgroundDots.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<BackgroundDots />
{@render children()}
