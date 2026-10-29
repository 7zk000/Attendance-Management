<script lang="ts">
	import { untrack } from 'svelte';
	import Input from './Input.svelte';
	import Select from './Select.svelte';

	// 決まった選択肢に加えて「未選択」と「その他(自由入力)」を選べるSelect。
	// value には選択肢の値、自由入力の値(format済み)、または未選択の '' が入る。
	type Props = {
		options: string[];
		value?: string;
		emptyLabel?: string;
		otherPlaceholder?: string;
		// 自由入力を保存形式に変換する(例: 場所は【】で囲む)。parse はその逆変換。
		format?: (text: string) => string;
		parse?: (value: string) => string;
	};

	let {
		options,
		value = $bindable(''),
		emptyLabel = '未選択',
		otherPlaceholder = '入力してください',
		format = (text: string) => text,
		parse = (stored: string) => stored
	}: Props = $props();

	const OTHER = '__other__';

	let choice = $state('');
	let otherText = $state('');

	let selectOptions = $derived([
		{ label: emptyLabel, value: '' },
		...options.map((label) => ({ label, value: label })),
		{ label: 'その他(入力)', value: OTHER }
	]);

	function compose(currentChoice: string, text: string) {
		if (currentChoice !== OTHER) return currentChoice;
		const trimmed = text.trim();
		return trimmed ? format(trimmed) : '';
	}

	// 親から value が変わった(記録の読み込みなど)ときに、選択状態を合わせる。
	$effect.pre(() => {
		const next = value ?? '';
		untrack(() => {
			if (next === compose(choice, otherText)) return;
			if (next === '' || options.includes(next)) {
				choice = next;
			} else {
				choice = OTHER;
				otherText = parse(next);
			}
		});
	});

	// 選択・入力の変更を親へ反映する。
	$effect(() => {
		const next = compose(choice, otherText);
		untrack(() => {
			if (next !== value) value = next;
		});
	});
</script>

<Select options={selectOptions} bind:value={choice} />
{#if choice === OTHER}
	<Input bind:value={otherText} placeholder={otherPlaceholder} />
{/if}
