<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import QueryProvider from '$lib/components/query-provider.svelte';
  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';

  let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<QueryProvider client={data.queryClient}>
  <Sidebar.Provider>
    <AppSidebar />
    <main class="w-full p-2 md:p-4">
      <Sidebar.Trigger />
      {@render children()}
    </main>
  </Sidebar.Provider>
</QueryProvider>
