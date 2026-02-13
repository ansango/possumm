<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
  import type { QueryClient } from '@tanstack/svelte-query';
  import type { Snippet } from 'svelte';

  let { children, client }: { children: Snippet; client: QueryClient } = $props();
</script>

<QueryClientProvider {client}>
  {@render children()}
  <SvelteQueryDevtools />
</QueryClientProvider>
