<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
  import type { TooltipActionOptions } from '$lib/tooltip/tooltip.action'
  import { page } from '$app/state'
  import Brand from './Brand.svelte'
  import BrandButton from './BrandButton.svelte'

  /**
   * The one compact top bar, shared by the app and the docs: the brand on
   * the left; on the right, the page's own actions (the app's Import /
   * Export / Metadata) and the red button that crosses to the other half of
   * the site.
   */
  interface Props {
    /** Page actions, placed before the red button (the app passes its own). */
    actions?: Snippet
    /** The app's tooltip, for the brand's version link (the app passes it). */
    tooltip?: Action<HTMLElement, TooltipActionOptions>
  }

  let { actions, tooltip }: Props = $props()

  const isApp = $derived(page.url.pathname === '/')
</script>

<header>
  <Brand heading={isApp} {tooltip} />
  <span class="spacer"></span>
  {#if actions}
    <nav class="actions" aria-label="Workspace">
      {@render actions()}
    </nav>
    <span class="divider" aria-hidden="true"></span>
  {/if}
  {#if isApp}
    <BrandButton href="/docs" label="Read guide" shortLabel="Guide" />
  {:else}
    <BrandButton href="/" label="Launch app" shortLabel="App" />
  {/if}
</header>

<style>
  header {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--site-header-height);
    padding: 0 8px;
    background-color: var(--c-white);
    border-bottom: 1px solid var(--c-border);
    position: relative;
    z-index: 100;
  }

  .spacer {
    flex: 1;
  }

  .divider {
    width: 1px;
    height: 20px;
    margin: 0 4px;
    background-color: var(--c-border);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  @media (max-width: 640px) {
    header {
      gap: 4px;
      padding: 0 8px;
    }

    .divider {
      margin: 0 2px;
    }
  }
</style>
