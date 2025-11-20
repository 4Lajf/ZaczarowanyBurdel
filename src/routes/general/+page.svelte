<script lang="ts">
    import CategoryPage from "$lib/components/CategoryPage.svelte";
    let { data } = $props();
</script>
<CategoryPage category="general" rawData={data.rawData || []} nonGenericTags={data.nonGenericTags || []} />
