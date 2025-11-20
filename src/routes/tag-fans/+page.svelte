<script lang="ts">
	//@ts-nocheck
	import * as Card from '$lib/components/ui/card';
	import EChart from '$lib/components/EChart.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Info, Search, ArrowLeft } from 'lucide-svelte';
	import { getBiggestFansByTag, getTagFanBreakdown, type Metric } from '$lib/data/relevance';
	import type { Category } from '$lib/data/types';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	let { data } = $props();
	const rawData = $derived(data.rawData || []);
	const nonGenericTags = $derived(data.nonGenericTags || []);

	// Global metric mode
	const metricStore = getContext<Writable<Metric>>('metricMode');
	const metric = $derived($metricStore);

	let limit = $state([50]);
	let filterGeneric = $state(true);
	let selectedTag = $state<string | null>(null);
	let searchQuery = $state('');
	
	// View Mode: 'main' or 'detail'
	let viewMode = $state<'main' | 'detail'>('main');

	// Category filters state
	let enabledCategories = $state<Record<string, boolean>>({
		character: true,
		copyright: true,
		artist: true,
		general: true
	});

	let activeCategories = $derived(
		Object.entries(enabledCategories)
			.filter(([_, enabled]) => enabled)
			.map(([cat]) => cat as Category)
	);

	let fansData = $derived(
		getBiggestFansByTag({
			data: rawData,
			limit: limit[0],
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined,
			categories: activeCategories
		})
	);

	let filteredFansData = $derived.by(() => {
		if (!searchQuery.trim()) return fansData;
		const q = searchQuery.toLowerCase();
		return fansData.filter(d => d.tag.toLowerCase().includes(q));
	});

	// Detail View Data
	let selectedTagData = $derived.by(() => {
		if (!selectedTag) return null;
		const base = fansData.find(d => d.tag === selectedTag);
		
		// Even if filtering excluded it from the list, we might still want to show it if selected
		// But for now, let's assume if it's selected, it was in the list.
		// If base is missing (e.g. limit changed), fallback to finding in full data is hard without re-running.
		// So if missing, we probably shouldn't show detail or should close it.
		if (!base) return null; 
		
		const breakdown = getTagFanBreakdown({
			data: rawData,
			tag: selectedTag,
			category: base.category,
			metric
		});
		
		return {
			...base,
			breakdown
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

	let mainChartOptions = $derived.by(() => {
		const dataToChart = searchQuery.trim() ? filteredFansData : fansData;
		
		const tags = dataToChart.map((d) => d.tag);
		const values = dataToChart.map((d) => d.fanCount);
		const colors = dataToChart.map((d) => getCategoryColor(d.category));

		return {
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				formatter: (params: any) => {
					const idx = params[0].dataIndex;
					const item = dataToChart[idx];
					return `
						<div class="font-bold mb-1">${item.tag}</div>
						<div class="text-xs mb-1" style="color: ${getCategoryColor(item.category)}">${item.category}</div>
						<div class="text-xs">Biggest Fan: <span class="font-semibold text-purple-400">${item.fanUserId}</span></div>
						<div class="text-xs">Fan Score: ${item.fanCount}</div>
						<div class="text-xs opacity-70">Total Tag Score: ${item.totalCount}</div>
						<div class="text-xs opacity-70 mt-1">Fan Share: ${((item.fanCount / item.totalCount) * 100).toFixed(1)}%</div>
					`;
				}
			},
			grid: {
				left: '3%',
				right: '4%',
				bottom: '3%',
				containLabel: true
			},
			xAxis: {
				type: 'category',
				data: tags,
				axisLabel: {
					interval: 0,
					rotate: 45,
					color: '#ccc',
					fontSize: 10,
					formatter: (value: string) => (value.length > 12 ? value.slice(0, 10) + '...' : value)
				}
			},
			yAxis: {
				type: 'value',
				splitLine: { lineStyle: { color: '#333' } },
				axisLabel: { color: '#ccc' }
			},
			series: [
				{
					name: 'Fan Score',
					type: 'bar',
					data: values.map((val, i) => ({
						value: val,
						itemStyle: { color: colors[i] }
					})),
					itemStyle: {
						borderRadius: [4, 4, 0, 0]
					}
				}
			]
		};
	});
	
	let pieOptions = $derived.by(() => {
		if (!selectedTagData) return {};
		
		// Take top 15 users + 'Others' for a better pie
		const users = selectedTagData.breakdown;
		const topUsers = users.slice(0, 15);
		const otherCount = users.slice(15).reduce((acc, u) => acc + u.count, 0);
		
		const pieData = topUsers.map(u => ({
			name: u.userId,
			value: u.count
		}));
		
		if (otherCount > 0) {
			pieData.push({ name: 'Others', value: otherCount });
		}
		
		return {
			backgroundColor: 'transparent',
			tooltip: {
				trigger: 'item',
				formatter: (params: any) => {
					return `
						<div class="font-bold mb-1">${params.name}</div>
						<div class="text-xs">Count: ${params.value}</div>
						<div class="text-xs">Share: ${params.percent}%</div>
					`;
				}
			},
			legend: {
				type: 'scroll',
				orient: 'vertical',
				right: 10,
				top: 20,
				bottom: 20,
				textStyle: { color: '#ccc' }
			},
			series: [
				{
					type: 'pie',
					radius: ['40%', '70%'],
					center: ['40%', '50%'],
					avoidLabelOverlap: false,
					itemStyle: {
						borderRadius: 10,
						borderColor: '#1e1e1e',
						borderWidth: 2
					},
					label: {
						show: false,
						position: 'center'
					},
					emphasis: {
						label: {
							show: true,
							fontSize: 16,
							fontWeight: 'bold',
							color: '#fff',
							formatter: '{b}\n{d}%'
						}
					},
					labelLine: {
						show: false
					},
					data: pieData
				}
			]
		};
	});

	function onChartClick(params: any) {
		if (params.componentType === 'series') {
			const dataToChart = searchQuery.trim() ? filteredFansData : fansData;
			const item = dataToChart[params.dataIndex];
			if (item) {
				selectedTag = item.tag;
				viewMode = 'detail';
			}
		}
	}

	function onListClick(tag: string) {
		selectedTag = tag;
		viewMode = 'detail';
	}

	function goBack() {
		viewMode = 'main';
		selectedTag = null;
	}
</script>

<div class="flex flex-col gap-4 h-[calc(100vh-4rem)] overflow-hidden">
	<!-- Controls Header -->
	<Card.Card class="shrink-0 p-4 bg-muted/30 border-none rounded-none md:rounded-lg">
		<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
			<div class="space-y-1">
				<h2 class="text-lg font-semibold tracking-tight">Tag Fanatics</h2>
				<p class="text-xs text-muted-foreground">
					Discover who interacts most with top tags.
					{#if metric === 'interactions'}
						Metric: <span class="font-medium text-foreground">Interactions</span> (Authoring or Reacting).
					{:else if metric === 'posts'}
						Metric: <span class="font-medium text-foreground">Posts</span> (Authorship only).
					{:else if metric === 'reactions'}
						Metric: <span class="font-medium text-foreground">Reactions Given</span>.
					{:else}
						Metric: <span class="font-medium text-foreground">Popularity</span> (Reactions Received).
					{/if}
				</p>
			</div>

			{#if viewMode === 'main'}
				<div class="flex flex-wrap items-center gap-4 md:gap-6">
					<!-- Limit Slider -->
					<div class="flex flex-col gap-1.5 w-[120px]">
						<div class="flex justify-between text-xs">
							<span class="text-muted-foreground">Top Tags</span>
							<span class="font-medium">{limit[0]}</span>
						</div>
						<Slider bind:value={limit} min={10} max={100} step={10} class="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4" />
					</div>

					<div class="h-8 w-px bg-border hidden md:block"></div>

					<!-- Category Filters -->
					<div class="flex items-center gap-3">
						{#each ['character', 'copyright', 'artist', 'general'] as cat}
							<div class="flex items-center space-x-2">
								<Switch
									id="filter-{cat}"
									bind:checked={enabledCategories[cat]}
									class="scale-75 origin-left"
								/>
								<Label
									for="filter-{cat}"
									class="cursor-pointer text-xs capitalize"
									style="color: {enabledCategories[cat]
										? getCategoryColor(cat as Category)
										: 'hsl(var(--foreground) / 0.7)'}"
								>
									{cat}
								</Label>
							</div>
						{/each}
					</div>

					<div class="h-8 w-px bg-border hidden md:block"></div>

					<!-- Generic Filter -->
					<div class="flex items-center space-x-2">
						<Label for="filter-generic" class="cursor-pointer text-xs whitespace-nowrap">No Generics</Label>
						<Switch id="filter-generic" bind:checked={filterGeneric} class="scale-75" />
					</div>
				</div>
			{:else}
				<!-- Detail View Controls (Back Button) -->
				<div class="flex items-center gap-4">
					<Button variant="outline" size="sm" onclick={goBack} class="gap-2">
						<ArrowLeft class="h-4 w-4" />
						Back to Overview
					</Button>
				</div>
			{/if}
		</div>
	</Card.Card>

	<!-- Main Content -->
	<div class="flex-1 grid grid-cols-1 md:grid-cols-[1fr_350px] gap-4 min-h-0">
		<!-- Chart Area (Switches between Bar and Pie) -->
		<Card.Card class="flex flex-col p-4 bg-background/50 backdrop-blur border-border/50 min-h-0 relative">
			<div class="flex-1 w-full min-h-0">
				{#if viewMode === 'main'}
					<EChart options={mainChartOptions} height="100%" onEvents={{ click: onChartClick }} />
				{:else if selectedTagData}
					<div class="h-full w-full flex flex-col">
						<div class="mb-4 text-center">
							<h3 class="text-xl font-bold flex items-center justify-center gap-2">
								{selectedTagData.tag}
								<Badge variant="outline" style="background-color: {getCategoryColor(selectedTagData.category)}20; color: {getCategoryColor(selectedTagData.category)}">
									{selectedTagData.category}
								</Badge>
							</h3>
							<p class="text-sm text-muted-foreground">
								Total Score: {selectedTagData.totalCount}
							</p>
						</div>
						<div class="flex-1 min-h-0">
							<EChart options={pieOptions} height="100%" />
						</div>
					</div>
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						Select a tag to see details
					</div>
				{/if}
			</div>
			{#if viewMode === 'main'}
				<div class="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
					<Info class="h-3 w-3" />
					Click a bar to view detailed fan distribution
				</div>
			{/if}
		</Card.Card>

		<!-- Side List -->
		<Card.Card class="flex flex-col overflow-hidden bg-background/50 backdrop-blur border-border/50">
			{#if viewMode === 'main'}
				<!-- Main List View -->
				<div class="p-3 border-b bg-muted/20 space-y-2">
					<h3 class="font-semibold text-sm">Top Fans Ranking</h3>
					<div class="relative">
						<Search class="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
						<input 
							type="text" 
							bind:value={searchQuery}
							placeholder="Search tags..."
							class="w-full h-8 rounded-md border border-border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>
				<div class="flex-1 overflow-y-auto p-0">
					<table class="w-full text-xs text-left">
						<thead class="bg-muted/30 text-muted-foreground sticky top-0 z-10 backdrop-blur-sm">
							<tr>
								<th class="p-2 font-medium">Tag</th>
								<th class="p-2 font-medium text-right">Fan</th>
								<th class="p-2 font-medium text-right">Score</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/50">
							{#each filteredFansData as item}
								<tr 
									class="group transition-colors hover:bg-muted/40 cursor-pointer {selectedTag === item.tag ? 'bg-primary/10' : ''}"
									onclick={() => onListClick(item.tag)}
								>
									<td class="p-2 max-w-[120px]">
										<div class="font-medium truncate text-foreground" title={item.tag}>{item.tag}</div>
										<Badge variant="outline" class="mt-0.5 h-3.5 px-1 text-[9px] border-0" style="background-color: {getCategoryColor(item.category)}20; color: {getCategoryColor(item.category)}">
											{item.category}
										</Badge>
									</td>
									<td class="p-2 text-right">
										<div class="font-semibold text-purple-400 truncate max-w-[100px] ml-auto" title={item.fanUserId}>
											{item.fanUserId}
										</div>
										<div class="text-[10px] text-muted-foreground">
											{((item.fanCount / item.totalCount) * 100).toFixed(0)}% share
										</div>
									</td>
									<td class="p-2 text-right tabular-nums font-medium">
										{item.fanCount}
									</td>
								</tr>
							{/each}
							{#if filteredFansData.length === 0}
								<tr>
									<td colspan="3" class="p-8 text-center text-muted-foreground">
										No data found for current filters.
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>
			{:else if selectedTagData}
				<!-- Detail List View (Top Fans Table) -->
				<div class="p-3 border-b bg-muted/20">
					<h3 class="font-semibold text-sm">Fan Breakdown</h3>
				</div>
				<div class="flex-1 overflow-y-auto p-0">
					<table class="w-full text-xs text-left">
						<thead class="bg-muted/30 text-muted-foreground sticky top-0 z-10 backdrop-blur-sm">
							<tr>
								<th class="p-2 font-medium">User</th>
								<th class="p-2 font-medium text-right">Count</th>
								<th class="p-2 font-medium text-right">Share</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/50">
							{#each selectedTagData.breakdown as user, i}
								<tr class="hover:bg-muted/20">
									<td class="p-2 flex items-center gap-2">
										<span class="font-mono text-xs text-muted-foreground w-4">{i + 1}</span>
										<span class="truncate max-w-[140px] font-medium" title={user.userId}>{user.userId}</span>
										{#if i === 0}
											<Badge variant="secondary" class="h-4 text-[9px] px-1">Top Fan</Badge>
										{/if}
									</td>
									<td class="p-2 text-right tabular-nums">{user.count}</td>
									<td class="p-2 text-right text-muted-foreground tabular-nums">{user.percentage.toFixed(1)}%</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card.Card>
	</div>
</div>
