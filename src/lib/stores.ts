import { writable } from 'svelte/store';

export type Metric = 'interactions' | 'posts' | 'popularity' | 'reactions';

export const metricMode = writable<Metric>('interactions');
