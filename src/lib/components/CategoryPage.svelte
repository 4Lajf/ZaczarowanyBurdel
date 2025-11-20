<script lang="ts">
	//@ts-nocheck
	import { getTopTags, getTagNeighbors, type Metric } from '$lib/data/relevance';
	import type { Category, ImageRecord } from '$lib/data/types';
	import * as Card from '$lib/components/ui/card';
	import EChart from '$lib/components/EChart.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { Info, ArrowLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	interface Props {
		category: Category;
		rawData: ImageRecord[];
		nonGenericTags?: string[];
	}

	let { category, rawData, nonGenericTags = [] }: Props = $props();

	let tagLimit = $state([20]);
	let neighborLimit = $state([30]);
	let selectedTag = $state<string | null>(null);
	let filterGeneric = $state(true);
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

	// Global metric mode
	const metricStore = getContext<Writable<Metric>>('metricMode');
	const metric = $derived($metricStore);
	const metricLabel = $derived(
		metric === 'interactions' ? 'Interactions' : metric === 'posts' ? 'Posts' : metric === 'reactions' ? 'Reactions Given' : 'Popularity'
	);

	let topTags = $derived(
		getTopTags({
			data: rawData,
			category,
			limit: tagLimit[0],
			metric,
			allowedGeneralTags: category === 'general' && filterGeneric ? nonGenericTags : undefined
		})
	);

	let barOptions = $derived.by(() => {
		return {
			backgroundColor: 'transparent',
			title: { text: `Top ${category} Tags`, left: 'center', textStyle: { color: '#e5e5e5' } },
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				formatter: function (params: any) {
					const p = params[0];
					return `${p.name}<br/>${metricLabel}: <b>${p.value}</b>`;
				}
			},
			xAxis: {
				type: 'category',
				data: topTags.map((t) => t.tag),
				axisLabel: { rotate: 30, color: '#e5e5e5' }
			},
			yAxis: {
				type: 'value',
				axisLabel: { color: '#e5e5e5' },
				splitLine: { lineStyle: { color: '#444' } }
			},
			series: [
				{
					name: metricLabel,
					type: 'bar',
					data: topTags.map((t) => t.count),
					itemStyle: { color: getCategoryColor(category) },
					emphasis: { itemStyle: { color: '#fff' } }
				}
			]
		};
	});

	function onBarClick(params: any) {
		if (params.componentType === 'series') {
			selectedTag = params.name;
		}
	}

	function clearSelection() {
		selectedTag = null;
	}

	let neighborData = $derived.by(() => {
		if (!selectedTag) return null;
		// Fetch a large number of neighbors first, then we'll filter and limit
		const base = getTagNeighbors({
			data: rawData,
			targetTag: selectedTag,
			limit: 200, // Fetch many neighbors initially
			minCooccurrence: 2,
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined
		});

		// Apply category filters, but always keep the selected tag itself
		const catOrder = ['character', 'copyright', 'artist', 'general'] as const;
		let filteredNodes = base.nodes;
		let filteredLinks = base.links;

		if (activeCategories.length) {
			const allowed = new Set(activeCategories);

			filteredNodes = base.nodes.filter((n) => {
				if (n.id === selectedTag) return true;
				const catName =
					typeof n.category === 'string' ? n.category : catOrder[n.category as number];
				return allowed.has(catName as Category);
			});

			const visible = new Set(filteredNodes.map((n) => n.id));
			filteredLinks = base.links.filter(
				(l) => visible.has(l.source as string) && visible.has(l.target as string)
			);
		}

		// Limit to configured max nodes (excluding the selected tag itself)
		const selectedTagNode = filteredNodes.find((n) => n.id === selectedTag);
		const otherNodes = filteredNodes
			.filter((n) => n.id !== selectedTag)
			.slice(0, neighborLimit[0]);

		const finalNodes = selectedTagNode ? [selectedTagNode, ...otherNodes] : otherNodes;
		const finalNodeIds = new Set(finalNodes.map((n) => n.id));
		const finalLinks = filteredLinks.filter(
			(l) => finalNodeIds.has(l.source as string) && finalNodeIds.has(l.target as string)
		);

		return {
			nodes: finalNodes,
			links: finalLinks
		};
	});

	let graphOptions = $derived.by(() => {
		if (!neighborData) return null;

		// Map categories to colors
		const categories = ['character', 'copyright', 'artist', 'general'];

		return {
			backgroundColor: 'transparent',
			title: {
				text: `Co-occurrence Network: ${selectedTag}`,
				left: 'center',
				textStyle: { color: '#e5e5e5' }
			},
			tooltip: {},
			legend: [
				{
					data: categories.map((c) => c),
					textStyle: { color: '#e5e5e5' },
					bottom: 0
				}
			],
					series: [
				{
					type: 'graph',
					layout: 'force',
					data: neighborData.nodes.map((n) => ({
						id: n.id,
						name: n.name,
						value: n.value,
						category: typeof n.category === 'string' ? categories.indexOf(n.category) : n.category,
						symbolSize: scaleNodeSize(n.value),
						label: {
							show: true,
							color: '#fff',
							textBorderColor: '#000',
							textBorderWidth: 2
						},
						itemStyle: {
							borderColor: '#fff',
							borderWidth: 1
						}
					})),
					links: neighborData.links.map((l) => ({
						source: l.source,
						target: l.target,
						value: l.value,
						lineStyle: {
							width: Math.max(0.5, Math.min(3, l.value / 10)),
							opacity: 0.7,
							color: '#888'
						}
					})),
					categories: categories.map((name) => ({
						name,
						itemStyle: { color: getCategoryColor(name as Category) }
					})),
					roam: true,
					label: { position: 'right' },
					force: { repulsion: 300, edgeLength: 100 },
					lineStyle: { color: 'source', curveness: 0.3 }
				}
			]
		};
	});

	function scaleNodeSize(val: number) {
		// Simple log scale
		return Math.max(10, Math.min(60, Math.log2(val + 1) * 5));
	}

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
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<h2 class="text-2xl font-bold text-foreground capitalize">{category} Analysis</h2>
		</div>
		<div class="flex items-center gap-6">
			{#if category === 'general' || selectedTag}
				<div class="flex items-center gap-2">
					<Label
						for="filter-generic"
						class="cursor-pointer text-xs font-normal text-muted-foreground">Filter Generic</Label
					>
					<Switch id="filter-generic" bind:checked={filterGeneric} class="scale-75" />
				</div>
			{/if}
			<div class="flex items-center gap-4">
				<span class="text-sm font-medium text-foreground">Top {tagLimit[0]} Tags</span>
				<Slider bind:value={tagLimit} min={10} max={50} step={5} class="w-[200px]" />
			</div>
		</div>
	</div>

	{#if selectedTag}
		<Button variant="outline" size="sm" class="w-fit gap-2 text-foreground border-border hover:bg-accent hover:text-accent-foreground" onclick={clearSelection}>
			<ArrowLeft class="h-4 w-4" />
			Back to All Tags
		</Button>
	{/if}

	<!-- Show Bar Chart only if no tag selected -->
	{#if !selectedTag}
		<div class="animate-in duration-300 fade-in slide-in-from-left-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						Tag Popularity
						<div class="group relative flex items-center">
							<Info class="h-4 w-4 cursor-help text-foreground/70" />
							<div
								class="absolute top-6 left-1/2 z-50 hidden w-64 -translate-x-1/2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md group-hover:block"
							>
								{#if metric === 'interactions'}
									The number represents total <b>{metricLabel}</b>.<br />
									Sum of reactions + authorship across all images with this tag.
								{:else if metric === 'posts'}
									The number represents total <b>{metricLabel}</b>.<br />
									Number of posts (authored images) that include this tag.
								{:else if metric === 'reactions'}
									The number represents total <b>{metricLabel}</b>.<br />
									Sum of reactions given by users to posts containing this tag (excluding author's own reaction).
								{:else}
									The number represents total <b>{metricLabel}</b>.<br />
									{category === 'character'
										? "Total reactions from other users on all posts featuring this character (excludes the author's own post - measures how much others engage with content about this character)."
										: category === 'copyright'
											? "Total reactions from other users on all posts from this franchise/copyright (excludes the author's own post - measures popularity of content from this source among the community)."
											: category === 'artist'
												? "Total reactions from other users on all posts tagged with this artist (excludes the author's own post - measures how much others engage with art by this artist)."
												: "Total reactions from other users on all posts with this tag (excludes the author's own post - measures how much others engage with content having this attribute)."}
								{/if}
							</div>
						</div>
					</Card.Title>
					<Card.Description>Ranked by total user engagement.</Card.Description>
				</Card.Header>
				<Card.Content>
					<EChart options={barOptions} height="400px" onEvents={{ click: onBarClick }} />
					<p class="mt-2 text-center text-sm text-foreground/75">
						Click a bar to explore relations
					</p>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}

	{#if selectedTag && graphOptions}
		<div class="animate-in duration-500 fade-in slide-in-from-right-4">
			<Card.Root>
				<Card.Header>
					<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<Card.Title>Tag Network: {selectedTag}</Card.Title>
							<Card.Description>Tags that frequently appear with {selectedTag}</Card.Description>
						</div>
						<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
							<div class="flex flex-wrap items-center gap-4">
								<div class="space-y-1">
									<span class="text-xs font-medium uppercase text-foreground/80">Categories</span>
									<div class="flex flex-wrap gap-3">
										{#each ['character', 'copyright', 'artist', 'general'] as cat}
											<div class="flex items-center space-x-2">
												<Switch
													id="analysis-filter-{cat}"
													bind:checked={enabledCategories[cat]}
													class="origin-left scale-75"
												/>
												<Label
													for="analysis-filter-{cat}"
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
								</div>
								<div class="flex items-center gap-2">
									<Label
										for="analysis-filter-generic"
										class="cursor-pointer text-xs font-normal text-muted-foreground"
										>Filter Generic</Label
									>
									<Switch
										id="analysis-filter-generic"
										bind:checked={filterGeneric}
										class="scale-75"
									/>
								</div>
							</div>
							<div class="flex items-center gap-4">
								<span class="text-xs font-medium text-foreground/80">Max Nodes: {neighborLimit[0]}</span>
								<Slider bind:value={neighborLimit} min={10} max={100} step={5} class="w-[150px]" />
							</div>
						</div>
					</div>
				</Card.Header>
				<Card.Content>
					<EChart options={graphOptions} height="600px" />
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
