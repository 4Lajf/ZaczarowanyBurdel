<script lang="ts">
	//@ts-nocheck
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Sheet, SheetContent, SheetTrigger } from '$lib/components/ui/sheet';
	import * as SheetPrimitive from '$lib/components/ui/sheet';
	import {
		LayoutDashboard,
		Users,
		User,
		Copyright,
		Palette,
		Tag,
		Network,
		Menu,
		Info
	} from 'lucide-svelte';
	import { setContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import type { Metric } from '$lib/data/relevance';

	let { data, children } = $props();

	// Global metric mode (interactions vs posts) shared via context
	const metricStore: Writable<Metric> = writable('interactions');
	setContext('metricMode', metricStore);
	const metric = $derived($metricStore);

	const navItems = [
		{ href: '/', label: 'Overview', icon: LayoutDashboard },
		{ href: '/users', label: 'Users', icon: Users },
		{ href: '/character', label: 'Character', icon: User },
		{ href: '/copyright', label: 'Copyright', icon: Copyright },
		{ href: '/artist', label: 'Artist', icon: Palette },
		{ href: '/general', label: 'General', icon: Tag },
		{ href: '/relations', label: 'Relations', icon: Network }
	];

	let isMobileOpen = $state(false);
	let isRelationsPage = $derived($page.url.pathname === '/relations');

	function isCurrent(href: string) {
		if (href === '/') return $page.url.pathname === '/';
		return $page.url.pathname.startsWith(href);
	}

	function setMetric(mode: Metric) {
		metricStore.set(mode);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tag Affinity Explorer</title>
</svelte:head>

<div class="dark min-h-screen bg-background font-sans antialiased">
	<div
		class="grid min-h-screen w-full {isRelationsPage
			? ''
			: 'md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]'}"
	>
		<!-- Desktop Sidebar -->
		{#if !isRelationsPage}
			<div class="hidden border-r bg-muted/50 md:block">
				<div class="flex h-full max-h-screen flex-col gap-2">
					<div class="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
						<a href="/" class="flex items-center gap-2 font-semibold text-foreground">
							<Network class="h-6 w-6" />
							<span class="">Affinity Explorer</span>
						</a>
					</div>
					<div class="flex-1 overflow-auto py-2">
						<nav class="grid items-start px-2 text-sm font-medium lg:px-4">
							{#each navItems as item}
								<a
									href={item.href}
									class="flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary {isCurrent(
										item.href
									)
										? 'bg-muted text-primary'
										: 'text-foreground/80'}"
								>
									<item.icon class="h-4 w-4" />
									{item.label}
								</a>
							{/each}
						</nav>
					</div>
				</div>
			</div>
		{/if}

		<!-- Mobile & Main Content -->
		<div class="flex flex-col">
			{#if !isRelationsPage}
				<header class="flex h-14 items-center gap-4 border-b bg-muted/50 px-4 lg:h-[60px] lg:px-6">
					<Sheet bind:open={isMobileOpen}>
						<SheetTrigger>
							<Button variant="outline" size="icon" class="shrink-0 md:hidden">
								<Menu class="h-5 w-5" />
								<span class="sr-only">Toggle navigation menu</span>
							</Button>
						</SheetTrigger>
						<SheetContent side="left" class="flex flex-col">
							<nav class="grid gap-2 text-lg font-medium">
								<a
									href="/"
									class="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"
								>
									<Network class="h-6 w-6" />
									<span class="sr-only">Affinity Explorer</span>
								</a>
								{#each navItems as item}
									<a
										href={item.href}
										onclick={() => (isMobileOpen = false)}
										class="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 hover:text-foreground {isCurrent(
											item.href
										)
											? 'bg-muted text-foreground'
											: 'text-foreground/80'}"
									>
										<item.icon class="h-5 w-5" />
										{item.label}
									</a>
								{/each}
							</nav>
						</SheetContent>
					</Sheet>
					<div class="flex w-full flex-1 items-center justify-between">
						<!-- Section title -->
						<h1 class="text-lg font-semibold text-foreground md:text-xl">
							{navItems.find((i) => isCurrent(i.href))?.label || 'Dashboard'}
						</h1>

						<!-- Metric toggle -->
						<div class="hidden items-center gap-2 text-xs font-medium text-foreground sm:flex">
							<span class="text-[11px] text-foreground/80">Metric</span>
							<div
								class="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 p-0.5"
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
						</div>
					</div>
				</header>
			{/if}
			<main class="flex flex-1 flex-col {isRelationsPage ? 'p-0' : 'gap-4 p-4 lg:gap-6 lg:p-6'}">
				{#if data.error}
					<div
						class="rounded-lg border border-destructive/50 bg-destructive/20 p-4 text-destructive"
					>
						<h3 class="font-semibold">Error loading data</h3>
						<p>{data.error}</p>
					</div>
				{:else if !data.rawData || data.rawData.length === 0}
					<div class="flex h-full items-center justify-center">
						<div class="flex flex-col items-center gap-2">
							<!-- Spinner -->
							<div
								class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
							></div>
							<p class="text-foreground/80">Loading dataset...</p>
						</div>
					</div>
				{:else}
					{@render children()}
				{/if}
			</main>
		</div>
	</div>
</div>
