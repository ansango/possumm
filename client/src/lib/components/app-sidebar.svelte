<script lang="ts">
  import { Icon } from '$lib/components/ui/icons';
  import * as Sidebar from '$lib/components/ui/sidebar';

  const items = [
    {
      title: 'Home',
      url: '/',
      icon: Icon.Home
    },
    {
      title: 'Downloads',
      url: '/downloads',
      icon: Icon.Download
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: Icon.Settings
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
