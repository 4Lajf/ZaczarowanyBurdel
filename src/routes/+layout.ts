import type { ImageRecord } from '$lib/data/types';

export const ssr = false;
export const prerender = false;

export async function load({ fetch, url }) {
    try {
        const dataset = url.searchParams.get('dataset') || 'default';
        const dataFile = dataset === 'gelbooru' ? '/data/output_gelbooru.json' : '/data/output.json';
        
        const [dataRes, tagsRes] = await Promise.all([
            fetch(dataFile),
            fetch('/data/non_generic_tags.json')
        ]);

        if (!dataRes.ok) {
            throw new Error(`Failed to load data: ${dataRes.statusText}`);
        }
        
        const rawData: ImageRecord[] = await dataRes.json();
        const nonGenericTags: string[] = tagsRes.ok ? await tagsRes.json() : [];

        return { rawData, nonGenericTags, dataset };
    } catch (error) {
        console.error("Error loading data:", error);
        return { 
            rawData: [], 
            nonGenericTags: [], 
            dataset: 'default',
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
}
