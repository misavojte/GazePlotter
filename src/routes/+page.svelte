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
  import { Header, HeaderAction, StatusBar } from './components'
  import { announceVersionOnce } from './versionNotice'

  const demoDataPath = `${base}/data/demo.json?v=2`

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
</svelte:head>

<!-- The homepage is the app: the compact site bar over one canvas filling
     the rest of the screen, closed by the credit strip. GazePlotter is just the field; the bar drives it
     through getActions(). With nothing around it to scroll, the wheel pans. -->
<Header>
  {#snippet actions()}
    <HeaderAction
      label="Import"
      title="Load eye-tracking data or a saved workspace (Tobii, SMI, Gazepoint and more)"
      icon={Upload}
      disabled={!workspaceActions?.canImport}
      onclick={() => workspaceActions?.openImport()}
    />
    <HeaderAction
      label="Export"
      title="Save the workspace, figures or data"
      icon={Download}
      disabled={!workspaceActions?.canExport}
      onclick={() => workspaceActions?.openExport()}
    />
    <HeaderAction
      label="Metadata"
      title="Source, parsing and dataset details"
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
  }
</style>
