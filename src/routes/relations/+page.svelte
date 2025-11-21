<script lang="ts">
	//@ts-nocheck
	import * as Card from '$lib/components/ui/card';
	import EChart from '$lib/components/EChart.svelte';
	import { Slider } from '$lib/components/ui/slider';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label';
	import { Info, ArrowLeft, Home } from 'lucide-svelte';
	import { getGlobalNetwork, getTagNeighbors, getTopTags, getUserTagNeighbors, getTopUsers, type Metric } from '$lib/data/relevance';
	import type { Category, ImageRecord } from '$lib/data/types';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';

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

	let metricDescription = $derived.by(() => {
		if (metric === 'interactions') {
			return "Measures total engagement. Nodes = total unique people (authors + reactors). Edges = how often tags/users appear together in any activity.";
		} else if (metric === 'posts') {
			return "Measures content creation. Nodes = number of posts. Edges = co-occurrence in the same post.";
		} else if (metric === 'reactions') {
			return "Measures audience response. Nodes = total reactions given. Edges = tags/users connected by reaction events.";
		} else {
			// Popularity
			return "Measures influence. User Nodes = total reactions received. Tag Nodes = total people involved. Edges show who gets reactions for what content.";
		}
	});

	function setMetric(mode: Metric) {
		metricStore.set(mode);
	}

	let nodeLimit = $state([30]);
	let selectedNode = $state<string | null>(null);
	let selectedNodeType = $state<'tag' | 'user' | null>(null);
	let filterGeneric = $state(true);
	let searchQuery = $state('');

	// Category filters state
	let enabledCategories = $state<Record<string, boolean>>({
		character: true,
		copyright: true,
		artist: true,
		general: true,
		user: true
	});

	let activeCategories = $derived(
		Object.entries(enabledCategories)
			.filter(([_, enabled]) => enabled)
			.map(([cat]) => cat as Category | 'user')
	);

	// Pass activeCategories to getGlobalNetwork so it filters BEFORE limiting
	let networkData = $derived(
		getGlobalNetwork({
			data: rawData,
			limit: nodeLimit[0],
			allowedCategories: activeCategories,
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined
		})
	);

	// Tag stats for search (using posts metric so count = posts with tag)
	let searchTagStats = $derived(
		getTopTags({
			data: rawData,
			limit: 3000,
			metric: 'posts',
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined
		})
	);

	// Users for search
	let searchUsers = $derived(
		getTopUsers({
			data: rawData,
			limit: 1000,
			metric: 'posts' // Base on posting activity for search presence
		})
	);

	let searchResults = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return [];
		
		const tags = searchTagStats
			.filter((t) => t.tag.toLowerCase().includes(q))
			.slice(0, 50)
			.map(t => ({ ...t, kind: 'tag' as const }));
			
		const users = searchUsers
			.filter((u) => u.userId.toLowerCase().includes(q))
			.slice(0, 20)
			.map(u => ({ tag: u.userId, count: u.count, category: 'user', kind: 'user' as const }));

		// Interleave or just concat? Concat for now, users first if they match well
		return [...users, ...tags].slice(0, 50);
	});

	let graphOptions = $derived.by(() => {
		const categories = ['character', 'copyright', 'artist', 'general', 'user'];

		let nodesToShow: any[] = [];
		let linksToShow: any[] = [];

		if (selectedNode) {
			if (selectedNodeType === 'user') {
				const d = getUserNeighborsData(selectedNode);
				nodesToShow = d.nodes;
				linksToShow = d.links;
			} else {
				const d = getNeighborsData(selectedNode);
				nodesToShow = d.nodes;
				linksToShow = d.links;
			}
		} else {
			nodesToShow = networkData.nodes;
			linksToShow = networkData.links;
		}

		return {
			backgroundColor: 'transparent',
			title: { text: '', left: 'center', textStyle: { color: '#fff' } },
			tooltip: {},
			legend: [
				{
					data: categories.map((c) => c),
					textStyle: { color: '#e5e5e5' },
					bottom: 20,
					selectedMode: false
				}
			],
			series: [
				{
					type: 'graph',
					layout: 'force',
					data: nodesToShow.map((n) => ({
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
					links: linksToShow.map((l) => ({
						source: l.source,
						target: l.target,
						value: l.value,
						lineStyle: {
							width: Math.max(0.5, Math.min(2, l.value / 20)),
							opacity: 0.7,
							color: '#666'
						}
					})),
					categories: categories.map((name) => ({
						name,
						itemStyle: { color: getCategoryColor(name as Category | 'user') }
					})),
					roam: true,
					label: { position: 'right' },
					force: {
						repulsion: 1000,
						edgeLength: [100, 300],
						gravity: 0.05
					},
					lineStyle: { color: 'source', curveness: 0.3 },
					emphasis: {
						focus: 'adjacency',
						lineStyle: { width: 4 }
					}
				}
			]
		};
	});

	function getNeighborsData(nodeId: string) {
		// Fetch more neighbors than we plan to display so category filtering
		// doesn't shrink the graph too aggressively.
		const base = getTagNeighbors({
			data: rawData,
			targetTag: nodeId,
			limit: 200,
			minCooccurrence: 1,
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined,
			allowedCategories: activeCategories // Pass categories to find user neighbors
		});

		const catOrder = ['character', 'copyright', 'artist', 'general'] as const;
		let nodes = base.nodes;
		let links = base.links;

		// Apply category filters also to neighbor view, but always keep the selected node
		if (activeCategories.length) {
			const allowed = new Set(activeCategories);

			nodes = base.nodes.filter((n) => {
				if (n.id === nodeId) return true;
				
				// Handle user category specially for filtering
				if (n.category === 'user') {
					return allowed.has('user');
				}

				const catName =
					typeof n.category === 'string' ? n.category : catOrder[n.category as number];
				return allowed.has(catName as Category);
			});

			const visible = new Set(nodes.map((n) => n.id));
			links = base.links.filter(
				(l) => visible.has(l.source as string) && visible.has(l.target as string)
			);
		}

		// Enforce a reasonable neighbor limit (excluding the center node)
		const NEIGHBOR_LIMIT = 50;
		if (nodes.length > NEIGHBOR_LIMIT + 1) {
			const center = nodes[0];
			const neighbors = nodes.slice(1, NEIGHBOR_LIMIT + 1);
			nodes = [center, ...neighbors];
			const visible = new Set(nodes.map((n) => n.id));
			links = links.filter(
				(l) => visible.has(l.source as string) && visible.has(l.target as string)
			);
		}

		return { nodes, links };
	}

	function getUserNeighborsData(userId: string) {
		const base = getUserTagNeighbors({
			data: rawData,
			userId: userId,
			limit: 200,
			metric,
			allowedGeneralTags: filterGeneric ? nonGenericTags : undefined,
			allowedCategories: activeCategories
		});

		// The utility already applies allowedCategories, but we might need to enforce limit
		// if we requested more (200) to be safe.
		
		let nodes = base.nodes;
		let links = base.links;

		// Enforce limit
		const NEIGHBOR_LIMIT = 50;
		if (nodes.length > NEIGHBOR_LIMIT + 1) {
			// nodes[0] is the user (center)
			const center = nodes[0];
			const neighbors = nodes.slice(1, NEIGHBOR_LIMIT + 1);
			nodes = [center, ...neighbors];
			const visible = new Set(nodes.map((n) => n.id));
			links = links.filter(
				(l) => visible.has(l.source as string) && visible.has(l.target as string)
			);
		}

		return { nodes, links };
	}

	function scaleNodeSize(val: number) {
		return Math.max(8, Math.min(35, Math.log2(val + 1) * 4));
	}

	function getCategoryColor(cat: Category | 'user') {
		const map: Record<string, string> = {
			character: '#5470c6',
			copyright: '#91cc75',
			artist: '#fac858',
			general: '#ee6666',
			meta: '#73c0de',
			user: '#a855f7' // Purple-ish for users
		};
		return map[cat] || '#5470c6';
	}

	function onChartClick(params: any) {
		if (params.dataType === 'node') {
			selectedNode = params.name;
			// Check if the clicked node is a user node based on its category index in 'series.categories'
			// or by checking if it's in our user list?
			// Actually, 'category' in params.data is the index.
			// The categories array is ['character', 'copyright', 'artist', 'general', 'user']
			// So index 4 is user.
			const userCatIndex = 4;
			if (params.data.category === userCatIndex) {
				selectedNodeType = 'user';
			} else {
				selectedNodeType = 'tag';
			}
		} else {
			selectedNode = null;
			selectedNodeType = null;
		}
	}

	function clearSelection() {
		selectedNode = null;
		selectedNodeType = null;
	}

	function getNavUrl(href: string) {
		const url = new URL(href, $page.url.origin);
		// Preserve dataset query parameter
		if ($page.url.searchParams.get('dataset') === 'gelbooru') {
			url.searchParams.set('dataset', 'gelbooru');
		}
		return url.pathname + url.search;
	}
</script>

<div class="relative h-screen w-screen overflow-hidden bg-background">
	<!-- Back Button -->
	<div class="absolute top-4 left-4 z-50 flex flex-col gap-2">
		<Button
			variant="outline"
			size="sm"
			href={getNavUrl('/')}
			class="border-border bg-background/95 text-foreground shadow-lg backdrop-blur-sm hover:bg-background"
		>
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Dashboard
		</Button>
		{#if selectedNode}
			<Button
				variant="default"
				size="sm"
				onclick={clearSelection}
				class="border-border bg-background/95 text-foreground shadow-lg backdrop-blur-sm hover:bg-background"
			>
				<Home class="mr-2 h-4 w-4" />
				Back to Root View
			</Button>
		{/if}
	</div>

	<!-- Controls Overlay -->
	<div class="pointer-events-none absolute top-4 right-4 z-50 flex flex-col items-end gap-4">
		<!-- Metric Toggle -->
		<div
			class="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm"
		>
			<Button
				variant={metric === 'interactions' ? 'default' : 'ghost'}
				size="sm"
				class="h-7 px-3 text-[11px] {metric === 'interactions' ? '' : 'text-foreground!'}"
				onclick={() => setMetric('interactions')}
			>
				Interactions
			</Button>
			<Button
				variant={metric === 'reactions' ? 'default' : 'ghost'}
				size="sm"
				class="h-7 px-3 text-[11px] {metric === 'reactions' ? '' : 'text-foreground!'}"
				onclick={() => setMetric('reactions')}
			>
				Reactions
			</Button>
			<Button
				variant={metric === 'posts' ? 'default' : 'ghost'}
				size="sm"
				class="h-7 px-3 text-[11px] {metric === 'posts' ? '' : 'text-foreground!'}"
				onclick={() => setMetric('posts')}
			>
				Posts
			</Button>
			<Button
				variant={metric === 'popularity' ? 'default' : 'ghost'}
				size="sm"
				class="h-7 px-3 text-[11px] {metric === 'popularity' ? '' : 'text-foreground!'}"
				onclick={() => setMetric('popularity')}
			>
				Popularity
			</Button>
		</div>

		<!-- Filters Panel -->
		<div
			class="pointer-events-auto flex w-[280px] flex-col gap-4 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm"
		>
			<div>
				<h3 class="leading-none font-semibold tracking-tight text-foreground">
					Relations Explorer
				</h3>
				<p class="mt-2 text-xs text-foreground/70 leading-snug border-l-2 border-primary/50 pl-2">
					{metricDescription}
				</p>
			</div>

			<div class="space-y-3">
				<span class="text-xs font-medium text-foreground/80 uppercase">Categories</span>
				<div class="grid grid-cols-2 gap-2">
					{#each ['character', 'copyright', 'artist', 'general', 'user'] as cat}
						<div class="flex items-center space-x-2">
							<Switch
								id="filter-{cat}"
								bind:checked={enabledCategories[cat]}
								class="origin-left scale-75"
							/>
							<Label
								for="filter-{cat}"
								class="cursor-pointer text-xs capitalize"
								style="color: {enabledCategories[cat]
									? getCategoryColor(cat as Category | 'user')
									: 'hsl(var(--foreground) / 0.7)'}"
							>
								{cat}
							</Label>
						</div>
					{/each}
				</div>
			</div>

			<div class="space-y-3">
				<span class="text-xs font-medium text-foreground/80 uppercase">Data Filtering</span>
				<div class="flex items-center justify-between">
					<Label for="filter-generic" class="cursor-pointer text-xs text-foreground"
						>Filter Generic Tags</Label
					>
					<Switch id="filter-generic" bind:checked={filterGeneric} class="scale-75" />
				</div>
			</div>

			<div class="space-y-2">
				<span class="text-xs font-medium text-foreground/80 uppercase">Search Tag/User</span>
				<div class="relative">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search..."
						class="w-full rounded-md border border-border bg-background/90 px-2 py-1 text-xs text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
					/>
					{#if searchQuery.trim().length > 1 && searchResults.length}
						<div
							class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-background/95 text-xs shadow-lg"
						>
							{#each searchResults as t}
								<button
									type="button"
									class="flex w-full items-center justify-between px-2 py-1 text-left text-foreground hover:bg-accent hover:text-accent-foreground"
									onclick={() => {
										selectedNode = t.tag;
										selectedNodeType = t.kind === 'user' ? 'user' : 'tag';
										searchQuery = t.tag;
									}}
								>
									<div class="flex items-center gap-2">
										{#if t.kind === 'user'}
											<Badge variant="outline" class="h-4 px-1 text-[9px] bg-purple-500/10 text-purple-500 border-purple-500/20">User</Badge>
										{:else}
											<Badge variant="outline" class="h-4 px-1 text-[9px]">Tag</Badge>
										{/if}
										<span>{t.tag}</span>
									</div>
									<span class="text-[10px] text-foreground/70">{t.count}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs font-medium text-foreground/80 uppercase">Node Limit</span>
					<span class="text-xs font-bold text-foreground">{nodeLimit[0]}</span>
				</div>
				<Slider bind:value={nodeLimit} min={10} max={80} step={5} />
			</div>

			{#if selectedNode}
				<div class="mt-2 rounded border border-border bg-muted/80 p-2 text-xs">
					<div class="mb-1 flex items-center justify-between">
						<div class="flex items-center gap-2">
							{#if selectedNodeType === 'user'}
								<Badge variant="outline" class="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px] px-1 h-4">User</Badge>
							{/if}
							<span class="font-bold text-foreground">{selectedNode}</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-5 w-5 text-foreground hover:text-foreground"
							onclick={clearSelection}
						>
							<span class="sr-only">Close</span>
							×
						</Button>
					</div>
				</div>
			{:else}
				<div class="mt-2 flex items-start gap-2 text-xs text-foreground/70">
					<Info class="mt-0.5 h-3 w-3 shrink-0 text-foreground/70" />
					<p>Click on a node to focus. Drag to rearrange.</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Chart -->
	<div class="absolute inset-0 overflow-hidden">
		<div
			class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
			style="width: 300vw; height: 300vh; min-width: 300vw; min-height: 300vh;"
		>
			<EChart options={graphOptions} height="300vh" onEvents={{ click: onChartClick }} />
		</div>
	</div>
</div>
