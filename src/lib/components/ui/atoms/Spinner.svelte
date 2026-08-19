<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';

	type Props = { class?: string; label?: string };
	let { class: className = '', label = '読み込み中...' }: Props = $props();
</script>

<div class="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground {className}">
	<LoaderCircle class="h-4 w-4 animate-spin" />
	<span>{label}</span>
</div>
