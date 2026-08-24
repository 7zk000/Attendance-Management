<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		count?: number;
		class?: string;
	};

	let { count = 40, class: className = '' }: Props = $props();

	// Soft light points cycling through the app's accent hues, echoing the
	// blue/emerald/purple glow already used for the page's gradient backdrop.
	const palette = ['rgb(96 165 250 / 100%)', 'rgb(52 211 153 / 100%)', 'rgb(192 132 252 / 100%)'];

	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		type Dot = { x: number; y: number; r: number; vx: number; vy: number; a: number; color: string };
		let dots: Dot[] = [];
		let width = 0;
		let height = 0;
		let raf = 0;

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			width = container.clientWidth;
			height = container.clientHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function seed() {
			dots = Array.from({ length: count }, () => ({
				x: Math.random() * width,
				y: Math.random() * height,
				r: 1 + Math.random() * 2.5,
				vx: (Math.random() - 0.5) * 0.25,
				vy: (Math.random() - 0.5) * 0.25,
				a: 0.2 + Math.random() * 0.5,
				color: palette[Math.floor(Math.random() * palette.length)]
			}));
		}

		function draw() {
			ctx!.clearRect(0, 0, width, height);
			for (const d of dots) {
				ctx!.globalAlpha = d.a;
				ctx!.fillStyle = d.color;
				ctx!.beginPath();
				ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
				ctx!.fill();
			}
			ctx!.globalAlpha = 1;
		}

		function tick() {
			for (const d of dots) {
				d.x += d.vx;
				d.y += d.vy;
				if (d.x < -5) d.x = width + 5;
				if (d.x > width + 5) d.x = -5;
				if (d.y < -5) d.y = height + 5;
				if (d.y > height + 5) d.y = -5;
			}
			draw();
			raf = requestAnimationFrame(tick);
		}

		function start() {
			if (!raf && !reduced && !document.hidden) raf = requestAnimationFrame(tick);
		}
		function stop() {
			cancelAnimationFrame(raf);
			raf = 0;
		}

		resize();
		seed();
		draw();
		start();

		const resizeObserver = new ResizeObserver(() => {
			resize();
			seed();
			draw();
		});
		resizeObserver.observe(container);

		function handleVisibility() {
			if (document.hidden) stop();
			else start();
		}
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			stop();
			resizeObserver.disconnect();
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});
</script>

<div bind:this={container} class="bg-dots {className}" aria-hidden="true">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.bg-dots {
		position: fixed;
		inset: 0;
		z-index: -10;
		overflow: hidden;
		pointer-events: none;
	}
	.bg-dots canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
