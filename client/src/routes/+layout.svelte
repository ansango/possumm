<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import QueryProvider from '$lib/components/query-provider.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryProvider client={data.queryClient}>
	{@render children()}
</QueryProvider>
