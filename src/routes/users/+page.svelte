<script lang="ts">
	//@ts-nocheck
	import * as Card from '$lib/components/ui/card';
	import { Slider } from '$lib/components/ui/slider';
	import EChart from '$lib/components/EChart.svelte';
	import { getTopUsers, getTopUserTags, type Metric } from '$lib/data/relevance';
	import type { ImageRecord, Category } from '$lib/data/types';
	import { Badge } from '$lib/components/ui/badge';
	import { Info, ArrowLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	let { data } = $props();
	const rawData = $derived(data.rawData || []);
	const nonGenericTags = $derived(data.nonGenericTags || []);

	// Global metric mode
	const metricStore = getContext<Writable<Metric>>('metricMode');
	const metric = $derived($metricStore);
	const metricLabel = $derived(
		metric === 'interactions' ? 'Interactions' 
		: metric === 'posts' ? 'Posts' 
		: metric === 'reactions' ? 'Reactions Given'
		: 'Popularity'
	);

	let userLimit = $state([15]);
	let chartHeight = $state([400]); // fixed height, slider removed
	let selectedUserId = $state<string | null>(null);
	let filterGeneric = $state(true);
	let tagLimit = $state([20]);

	let topUsers = $derived(getTopUsers({ data: rawData, limit: userLimit[0], metric }));

	let userBarOptions = $derived.by(() => {
		return {
			backgroundColor: 'transparent',
			title: { text: 'Most Active Users', left: 'center', textStyle: { color: '#e5e5e5' } },
			tooltip: {
				trigger: 'item',
				formatter: function (params: any) {
					const label =
						metric === 'interactions' ? 'Images interacted with' 
						: metric === 'posts' ? 'Images authored' 
						: metric === 'reactions' ? 'Reactions given'
						: 'Reactions received';
					return `${params.name}<br/>${label}: <b>${params.value}</b>`;
				}
			},
			grid: { bottom: '10%', containLabel: true },
			xAxis: {
				type: 'category',
				data: topUsers.map((u) => u.userId),
				axisLabel: { interval: 0, rotate: 45, color: '#e5e5e5' }
			},
			yAxis: {
				type: 'value',
				axisLabel: { color: '#e5e5e5' },
				splitLine: { lineStyle: { color: '#444' } }
			},
			series: [
				{
					name: metric === 'interactions' ? 'Images (activity)' : metric === 'reactions' ? 'Reactions given' : metric === 'posts' ? 'Images (posts)' : 'Reactions received',
					type: 'bar',
					data: topUsers.map((u) => u.count),
					itemStyle: { color: '#5470c6' },
					emphasis: { itemStyle: { color: '#fff' } }
				}
			]
		};
	});

	function onChartClick(params: any) {
		if (params.componentType === 'series') {
			selectedUserId = params.name;
		}
	}

	let selectedUserTags = $derived.by(() => {
		if (!selectedUserId) return [];
		return getTopUserTags({ 
			data: rawData, 
			userId: selectedUserId, 
			limit: tagLimit[0], 
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined
		});
	});

	let userDetailOptions = $derived.by(() => {
		if (!selectedUserId) return null;
		return {
			backgroundColor: 'transparent',
			title: {
				text: `Top Tags for ${selectedUserId}`,
				left: 'center',
				textStyle: { color: '#e5e5e5' }
			},
			tooltip: {
				trigger: 'item',
				formatter: function (params: any) {
					return `${params.name}<br/>${metricLabel}: <b>${params.value}</b>`;
				}
			},
			grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
			xAxis: {
				type: 'value',
				axisLabel: { color: '#e5e5e5' },
				splitLine: { lineStyle: { color: '#444' } }
			},
			yAxis: {
				type: 'category',
				data: selectedUserTags.map((t) => t.tag).reverse(),
				axisLabel: { color: '#e5e5e5' }
			},
			series: [
				{
					name: metricLabel,
					type: 'bar',
					data: selectedUserTags
						.map((t) => ({
							value: t.count,
							itemStyle: { color: getCategoryColor(t.category) }
						}))
						.reverse()
				}
			]
		};
	});

	function getCategoryColor(cat: Category) {
		const map: Record<string, string> = {
			character: '#5470c6',
			copyright: '#91cc75',
			artist: '#fac858',
			general: '#ee6666',
			meta: '#73c0de'
		};
		return map[cat] || '#5470c6';
	}

	function clearSelection() {
		selectedUserId = null;
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h2 class="text-2xl font-bold text-foreground capitalize">User Analysis</h2>
		</div>
		<div class="flex items-center gap-6">
			<div class="flex items-center gap-4">
				<span class="text-sm font-medium text-foreground">Users: {userLimit[0]}</span>
				<Slider bind:value={userLimit} min={5} max={50} step={5} class="w-[200px]" />
			</div>
		</div>
	</div>

	{#if selectedUserId}
		<Button variant="outline" size="sm" class="w-fit gap-2 text-foreground border-border hover:bg-accent hover:text-accent-foreground" onclick={clearSelection}>
			<ArrowLeft class="h-4 w-4" />
			Back to All Users
		</Button>
	{/if}

	<!-- Show Bar Chart only if no user selected -->
	{#if !selectedUserId}
		<div class="animate-in duration-300 fade-in slide-in-from-left-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						User Activity
						<div class="group relative flex items-center">
							<Info class="h-4 w-4 cursor-help text-foreground/70" />
							<div
								class="absolute top-6 left-1/2 z-50 hidden w-64 -translate-x-1/2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md group-hover:block"
							>
								The number represents total <b>{metricLabel}</b>.<br />
								{metric === 'interactions'
									? 'Sum of images this user has interacted with (reacted to or authored).'
									: metric === 'posts'
										? 'Number of posts (authored images) by this user.'
										: metric === 'reactions'
											? 'Number of reactions this user has given to other posts (excluding their own).'
											: 'Total reactions received on posts authored by this user (measures how popular their content is).'}
							</div>
						</div>
					</Card.Title>
					<Card.Description>
						Ranked by {
							metric === 'interactions' ? 'total images they have interacted with' 
							: metric === 'posts' ? 'total images they have authored' 
							: metric === 'reactions' ? 'total reactions they have given'
							: 'total reactions received on their authored posts'
						}.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<EChart options={userBarOptions} height="{chartHeight[0]}px" onEvents={{ click: onChartClick }} />
					<p class="mt-2 text-center text-sm text-foreground/75">
						Click a bar to explore user details
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	{#if selectedUserId && userDetailOptions}
		<div class="animate-in duration-500 fade-in slide-in-from-right-4">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<Card.Title>User Detail: {selectedUserId}</Card.Title>
							<Card.Description>Tags ranked by {
								metric === 'interactions' 
									? 'how often this user interacted with posts containing these tags' 
									: metric === 'posts' 
									? 'how many posts they authored that include these tags' 
									: metric === 'reactions'
									? 'how often this user reacted to posts containing these tags'
									: 'total reactions received on their authored posts containing these tags (measures popularity of their content with each tag)'
							}.</Card.Description>
						</div>
						<div class="flex flex-col items-end gap-3">
							<div class="flex items-center gap-2">
								<Label for="filter-generic-user" class="cursor-pointer text-xs font-normal text-muted-foreground">Filter Generic</Label>
								<Switch id="filter-generic-user" bind:checked={filterGeneric} class="scale-75" />
							</div>
							<div class="flex items-center gap-4">
								<span class="text-xs font-medium text-muted-foreground">Tags: {tagLimit[0]}</span>
								<Slider bind:value={tagLimit} min={5} max={100} step={5} class="w-[150px]" />
							</div>
						</div>
					</div>
				</Card.Header>
				<Card.Content>
					<EChart options={userDetailOptions} height="850px" />
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
