<script>
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	} = $props();
</script>

<p
	bind:this={ref}
	data-slot="card-description"
	class={cn("text-card-foreground/80 text-sm", className)}
	{...restProps}
>
	{@render children?.()}
</p>