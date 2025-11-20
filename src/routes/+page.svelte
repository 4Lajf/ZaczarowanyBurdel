<script lang="ts">
    //@ts-nocheck
    import * as Card from "$lib/components/ui/card";
    import EChart from "$lib/components/EChart.svelte";
    import { getTopTags, type Metric } from "$lib/data/relevance";
    import type { ImageRecord, Category } from "$lib/data/types";
    import { Info } from "lucide-svelte";
    import { Switch } from '$lib/components/ui/switch';
    import { Label } from '$lib/components/ui/label';
    import { getContext } from "svelte";
    import type { Writable } from "svelte/store";

    let { data } = $props();
    const rawData = $derived(data.rawData || []);
    const nonGenericTags = $derived(data.nonGenericTags || []);

    // Global metric mode (interactions vs posts vs popularity)
    const metricStore = getContext<Writable<Metric>>("metricMode");
    const metric = $derived($metricStore);
    const metricLabel = $derived(
        metric === "interactions" ? "Interactions" 
        : metric === "posts" ? "Posts" 
        : metric === "reactions" ? "Reactions Given"
        : "Popularity"
    );

    let filterGeneric = $state(true);

    // KPIs
    let totalImages = $derived(rawData.length);
    
    let totalUsers = $derived.by(() => {
        const users = new Set<string>();
        rawData.forEach((r: ImageRecord) => {
            r.reactors.forEach(u => users.add(u));
            if(r.author) users.add(r.author);
        });
        return users.size;
    });

    let tagStats = $derived.by(() => {
         // Unique tags per category
         const counts: Record<string, Set<string>> = {
             character: new Set(),
             copyright: new Set(),
             artist: new Set(),
             general: new Set()
         };
         rawData.forEach((r: ImageRecord) => {
             (['character', 'copyright', 'artist', 'general'] as const).forEach(cat => {
                 r.tags[cat]?.forEach(t => counts[cat].add(t));
             });
         });
         return {
             character: counts.character.size,
             copyright: counts.copyright.size,
             artist: counts.artist.size,
             general: counts.general.size,
             total: Object.values(counts).reduce((acc, s) => acc + s.size, 0)
         };
    });

    // Charts Data
    let categoryOptions = $derived.by(() => {
        return {
            backgroundColor: 'transparent',
            title: { text: '', left: 'center' },
            tooltip: { trigger: 'item' },
            legend: { bottom: 0, textStyle: { color: '#e5e5e5' } },
            series: [
                {
                    name: 'Unique Tags',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    label: { color: '#fff' },
                    data: [
                        { value: tagStats.character, name: 'Character', itemStyle: { color: '#5470c6' } },
                        { value: tagStats.copyright, name: 'Copyright', itemStyle: { color: '#91cc75' } },
                        { value: tagStats.artist, name: 'Artist', itemStyle: { color: '#fac858' } },
                        { value: tagStats.general, name: 'General', itemStyle: { color: '#ee6666' } }
                    ]
                }
            ]
        };
    });

    let topTagsOptions = $derived.by(() => {
        const topTags = getTopTags({ 
            data: rawData, 
            limit: 20, 
            metric,
            allowedGeneralTags: filterGeneric ? nonGenericTags : undefined 
        });
        return {
            backgroundColor: 'transparent',
            title: { text: '' },
            tooltip: { 
                trigger: 'axis', 
                axisPointer: { type: 'shadow' },
                formatter: function (params: any) {
					const p = params[0];
					return `${p.name}<br/>${metricLabel}: <b>${p.value}</b>`;
				} 
            },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', splitLine: { lineStyle: { color: '#444' } }, axisLabel: { color: '#e5e5e5' } },
            yAxis: { type: 'category', data: topTags.map(t => t.tag).reverse(), axisLabel: { color: '#e5e5e5' } },
            series: [
                {
                    name: metricLabel,
                    type: 'bar',
                    data: topTags.map(t => ({
                        value: t.count,
                        itemStyle: {
                            color: getCategoryColor(t.category)
                        }
                    })).reverse()
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
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-sm font-medium">Total Images</Card.Title>
        </Card.Header>
        <Card.Content>
            <div class="text-2xl font-bold text-card-foreground">{totalImages}</div>
        </Card.Content>
    </Card.Root>
    <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-sm font-medium">Total Users</Card.Title>
        </Card.Header>
        <Card.Content>
            <div class="text-2xl font-bold text-card-foreground">{totalUsers}</div>
        </Card.Content>
    </Card.Root>
     <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-sm font-medium">Unique Tags</Card.Title>
        </Card.Header>
        <Card.Content>
            <div class="text-2xl font-bold text-card-foreground">{tagStats.total}</div>
            <p class="text-xs text-foreground/75">Across all categories</p>
        </Card.Content>
    </Card.Root>
</div>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-4">
    <Card.Root class="col-span-2 lg:col-span-3">
        <Card.Header>
            <Card.Title>Category Distribution</Card.Title>
        </Card.Header>
        <Card.Content>
            <EChart options={categoryOptions} height="350px" />
        </Card.Content>
    </Card.Root>
    <Card.Root class="col-span-2 lg:col-span-4">
        <Card.Header class="flex flex-row items-center justify-between">
             <div class="flex items-center gap-2">
                <Card.Title class="flex items-center gap-2">
                    Top Global Tags
                    <div class="group relative flex items-center">
                        <Info class="h-4 w-4 text-foreground/70 cursor-help" />
                        <div class="absolute left-1/2 top-6 z-50 hidden -translate-x-1/2 w-64 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md group-hover:block">
                            {#if metric === "interactions"}
                                Ranked by total <b>{metricLabel}</b> (reactions + authorship) across all images with each tag.
                            {:else if metric === "posts"}
                                Ranked by total <b>{metricLabel}</b> (number of authored posts) that include each tag.
                            {:else}
                                Ranked by total <b>{metricLabel}</b> (total reactions received on posts, excluding authorship). Measures how much people engage with content featuring each tag across all categories.
                            {/if}
                        </div>
                     </div>
                 </Card.Title>
             </div>
             <div class="flex items-center gap-2">
                <Label for="filter-generic" class="text-xs font-normal text-foreground/80">Filter Generic</Label>
                <Switch id="filter-generic" bind:checked={filterGeneric} class="scale-75" />
             </div>
        </Card.Header>
        <Card.Content>
            <EChart options={topTagsOptions} height="350px" />
        </Card.Content>
    </Card.Root>
</div>
