<script lang="ts">
    import * as echarts from 'echarts';
    import { onMount } from 'svelte';

    interface Props {
        options: echarts.EChartsOption;
        theme?: string | object;
        height?: string;
        onEvents?: Record<string, (params: any) => void>;
    }

    let { options, theme = 'dark', height = '400px', onEvents = {} }: Props = $props();
    
    let chartContainer: HTMLDivElement;
    let chartInstance: echarts.ECharts | null = null;

    onMount(() => {
        chartInstance = echarts.init(chartContainer, theme);
        chartInstance.setOption(options);

        // Attach events
        Object.entries(onEvents).forEach(([eventName, handler]) => {
            chartInstance?.on(eventName, handler);
        });

        const handleResize = () => {
            chartInstance?.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chartInstance?.dispose();
        };
    });

    $effect(() => {
        if (chartInstance && options) {
             // true = notMerge (removes components not in new option)
             chartInstance.setOption(options, true);
        }
    });
</script>

<div bind:this={chartContainer} style="width: 100%; height: {height};"></div>

