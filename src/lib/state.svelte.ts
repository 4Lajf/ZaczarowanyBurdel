export type Metric = 'interactions' | 'posts';

export const appState = $state<{ metric: Metric }>({
    metric: 'interactions'
});
