<script lang="ts">
	import ChoiceSelect from '../atoms/ChoiceSelect.svelte';
	import { getLocationOptions, getTaskTypeOptions } from '$lib/kintai-utils';

	// 場所・作業内容の入力欄(打刻画面と打刻修正モーダルで共用)。
	// 未選択は '' で、保存時は null として扱う。
	let { location = $bindable(''), taskType = $bindable('') }: { location?: string; taskType?: string } = $props();

	// 場所は既存の選択肢(【多摩】など)に合わせて【】で囲んで保存する。
	const formatLocation = (text: string) => (/^【.*】$/.test(text) ? text : `【${text}】`);
	const parseLocation = (stored: string) => stored.replace(/^【(.*)】$/, '$1');
</script>

<ChoiceSelect
	options={getLocationOptions()}
	bind:value={location}
	emptyLabel="場所: 未選択"
	otherPlaceholder="場所を入力(例: 渋谷)"
	format={formatLocation}
	parse={parseLocation}
/>
<ChoiceSelect
	options={getTaskTypeOptions()}
	bind:value={taskType}
	emptyLabel="作業内容: 未選択"
	otherPlaceholder="作業内容を入力"
/>
