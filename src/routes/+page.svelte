<script lang="ts">
  import { GazePlotter, fromUrl } from '$lib'
  import { base } from '$app/paths'
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import type { GazePlotterSession } from '$lib/session'
  import type { WorkspaceActions } from '$lib/workspace/actions.svelte'
  import Upload from 'lucide-svelte/icons/upload'
  import Download from 'lucide-svelte/icons/download'
  import FileText from 'lucide-svelte/icons/file-text'
  import { hostTooltipAction } from '$lib/tooltip'
  import { Header, HeaderAction, StatusBar } from './components'
  import { announceVersionOnce } from './versionNotice'

  const demoDataPath = `${base}/data/demo.json?v=3`

  // Read `?dataUrl=` once at mount. Switching sources mid-session needs a
  // page reload — matches GazePlotter's "load is one-shot" contract.
  const dataUrl = browser
    ? new URL(window.location.href).searchParams.get('dataUrl')
    : null
  const load = fromUrl(
    dataUrl ?? demoDataPath,
    dataUrl ? 'data.json' : 'demo.json'
  )

  let gazePlotterRef = $state<{
    getSession: () => GazePlotterSession
    getActions: () => WorkspaceActions
  }>()
  const workspaceActions = $derived(gazePlotterRef?.getActions())
  const tooltip = hostTooltipAction(() => gazePlotterRef?.getSession())

  onMount(() => {
    const session = gazePlotterRef?.getSession()
    if (session) announceVersionOnce(session.toastState)
  })
</script>

<svelte:head>
  <title
    >GazePlotter | Free Eye-Tracking Visualization: Scarf Plots, Scanpaths, AOI
    Metrics</title
  >
  <meta
    name="description"
    content="Free, open-source eye-tracking visualization in the browser: scarf plots, scanpaths, transition matrices and AOI metrics from Tobii, SMI, GazePoint, Varjo and Pupil Labs data. No registration, no data sent to a server."
  />
  <link rel="canonical" href="https://gazeplotter.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://gazeplotter.com/" />
  <meta
    property="og:title"
    content="GazePlotter | Free Eye-Tracking Visualization"
  />
  <meta
    property="og:description"
    content="Scarf plots, scanpaths, transition matrices and AOI metrics from Tobii, SMI, GazePoint, Varjo and Pupil Labs data. Free, open source, runs in your browser."
  />
</svelte:head>

<!-- The homepage is the app: the compact site bar over one canvas filling
     the rest of the screen, closed by the credit strip. GazePlotter is just the field; the bar drives it
     through getActions(). With nothing around it to scroll, the wheel pans. -->
<Header {tooltip}>
  {#snippet actions()}
    <HeaderAction
      label="Import"
      hint="Load eye-tracking data or a saved workspace (Tobii, SMI, Gazepoint and more)"
      {tooltip}
      icon={Upload}
      disabled={!workspaceActions?.canImport}
      onclick={() => workspaceActions?.openImport()}
    />
    <HeaderAction
      label="Export"
      hint="Save the workspace, figures or data"
      {tooltip}
      icon={Download}
      disabled={!workspaceActions?.canExport}
      onclick={() => workspaceActions?.openExport()}
    />
    <HeaderAction
      label="Metadata"
      hint="Source, parsing and dataset details"
      {tooltip}
      icon={FileText}
      disabled={!workspaceActions?.canShowMetadata}
      onclick={() => workspaceActions?.openMetadata()}
    />
  {/snippet}
</Header>
<main class="app">
  <GazePlotter {load} bind:this={gazePlotterRef} gestures="canvas" />
</main>
<StatusBar />

<style>
  /* Everything under the bar. A length, not 100%: the component's root has
     no height of its own for a percentage to resolve against. */
  .app {
    --app-height: calc(
      100dvh - var(--site-header-height) - var(--site-statusbar-height)
    );
    height: var(--app-height);
    overflow: hidden;
    --gp-workspace-height: var(--app-height);
    --gp-toaster-bottom: calc(var(--site-statusbar-height) + 8px);
  }
</style>
