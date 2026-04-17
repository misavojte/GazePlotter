<script lang="ts">
  import { onMount } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import { plotRegistry, getPlotDisplayName } from '$lib/plots/registry'
  import {
    getStimuliOptions,
    getParticipantsGroupOptions,
  } from '$lib/plots/shared'
  import PaneHeader from './PaneHeader.svelte'

  const { engine, grid } = getGazePlotterSession()

  const item = $derived(grid.selectedItem)

  const definition = $derived(
    item ? (plotRegistry as Record<string, any>)[item.type] : null
  )

  const PaneSettings = $derived(definition?.paneSettings ?? null)

  const title = $derived(item ? getPlotDisplayName(item.type) : '')

  const subtitle = $derived.by(() => {
    if (!item) return undefined
    const settings: any = item.settings ?? {}
    const parts: string[] = []
    if (typeof settings.stimulusId === 'number') {
      const stimOpt = getStimuliOptions(engine).find(
        o => o.value === String(settings.stimulusId)
      )
      if (stimOpt?.label) parts.push(stimOpt.label)
    }
    if (typeof settings.groupId === 'number') {
      const groupOpt = getParticipantsGroupOptions(
        engine,
        true,
        settings.stimulusId ?? 0
      ).find(o => o.value === String(settings.groupId))
      if (groupOpt?.label) parts.push(groupOpt.label)
    }
    return parts.length === 0 ? undefined : parts.join(' · ')
  })

  function close() {
    grid.setSelectedItem(null)
  }

  // Match Rail.svelte:17-24 viewport-anchoring mechanism so the pane's
  // content stays in view when the page is scrolled down. Unlike the rail
  // (which offsets -24px for its icon-only layout), the pane must stick
  // flush with the viewport top so the title isn't clipped.
  let bannerHeight = $state(0)
  let contentTop = $derived(bannerHeight)

  function detectOnScrollBannerHeight() {
    const banner = document.querySelector('.scroll-banner')
    if (banner) {
      bannerHeight = (banner as HTMLElement).offsetHeight
    }
  }

  onMount(() => {
    detectOnScrollBannerHeight()
    window.addEventListener('scroll', detectOnScrollBannerHeight, {
      passive: true,
    })
    return () =>
      window.removeEventListener('scroll', detectOnScrollBannerHeight)
  })

  $effect(() => {
    if (!item) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
</script>

{#if item && PaneSettings}
  <aside class="pane" aria-label={`${title} settings`}>
    <div
      class="pane-content"
      style="top: {contentTop}px; max-height: calc(100vh - {contentTop}px);"
    >
      <PaneHeader {title} {subtitle} onClose={close} />
      <div class="body">
        <PaneSettings {item} />
      </div>
    </div>
  </aside>
{/if}

<style>
  /* Mirrors Rail.svelte's .rail + .rail-content pattern:
     - outer flex child sits in workspace-body on the right
     - inner content is position:sticky so it stays visible while the page scrolls */
  .pane {
    flex: 0 0 400px;
    align-self: stretch;
    background-color: var(--c-lightgrey);
    z-index: 2;
    transition: background-color 0.3s ease;
    box-sizing: border-box;
    border-left: 1px solid var(--c-border);
  }

  .pane-content {
    position: sticky;
    top: unset; /* set inline from bannerHeight */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  /* Make form fields inside the pane fill the available width and align
     typography with PaneSection's small, muted label styling so controls
     read as a single form surface rather than a mix of floating widgets. */
  .body :global(.select-wrapper) {
    width: 100%;
  }
  .body :global(.input > label),
  .body :global(.group-container .legend) {
    font-size: 11px;
    font-weight: 400;
    color: var(--c-darkgrey);
    letter-spacing: 0.01em;
    line-height: 1.2;
  }
  .body :global(.trigger) {
    height: 30px;
    font-size: 12px;
  }
</style>
