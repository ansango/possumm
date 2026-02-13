<script lang="ts">
	import { Home, Download, Settings } from 'lucide-svelte';
	import * as Sidebar from '$lib/components/ui/sidebar';

	const items = [
		{
			title: 'Home',
			url: '/',
			icon: Home
		},
		{
			title: 'Downloads',
			url: '/downloads',
			icon: Download
		},
		{
			title: 'Settings',
			url: '/settings',
			icon: Settings
		}
	];
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each items as item (item.title)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton>
								{#snippet child({ props })}
									<!-- svelte-ignore svelte_no_navigation_without_resolve -->
									<a href={item.url} {...props}>
										<item.icon />
										<span>{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
