<script lang="ts">
  import {
    GazePlotter,
    fromUrl,
    hostTooltipAction,
    withShortcut,
    type GazePlotterSession,
    type WorkspaceActions,
  } from '$lib'
  import { base } from '$app/paths'
  import { beforeNavigate } from '$app/navigation'
  import { browser } from '$app/environment'
  import { onMount } from 'svelte'
  import Upload from 'lucide-svelte/icons/upload'
  import Download from 'lucide-svelte/icons/download'
  import FileText from 'lucide-svelte/icons/file-text'
  import { Header, HeaderAction, StatusBar } from './components'
  import { announceVersionOnce } from './versionNotice'
  import { cachedLoader } from './cachedLoader'
  import { registerServiceWorker } from './serviceWorker'

  // Versioned by content (vite.config.ts), so the stored copy never goes stale.
  const demoUrl = `${base}/data/demo.gazeplotter?v=${__DEMO_HASH__}`

  // Read `?dataUrl=` once at mount. Switching sources mid-session needs a
  // page reload — matches GazePlotter's "load is one-shot" contract.
  const dataUrl = browser
    ? new URL(window.location.href).searchParams.get('dataUrl')
    : null
  const load = dataUrl
    ? fromUrl(dataUrl)
    : cachedLoader(demoUrl, 'demo.gazeplotter')

  let gazePlotterRef = $state<{
    getSession: () => GazePlotterSession
    getActions: () => WorkspaceActions
  }>()
  const workspaceActions = $derived(gazePlotterRef?.getActions())
  const tooltip = hostTooltipAction(() => gazePlotterRef?.getSession())
  const saveStatus = {
    unsaved: 'Unsaved changes',
    saved: 'All changes saved',
    new: 'Not saved to a file yet',
  }
  const saveIndicator = $derived(workspaceActions?.saveIndicator ?? null)
  const exportHint = $derived(
    `${withShortcut('Save the workspace', 'save')}, or export figures and data` +
      (saveIndicator ? `. ${saveStatus[saveIndicator]}` : '')
  )

  // The user's own dataset names the tab, marked while it has unsaved work;
  // the demo and the server render keep the site title.
  const SITE_TITLE =
    'GazePlotter | Free Eye-Tracking Visualization: Scarf Plots, Scanpaths, AOI Metrics'
  const pageTitle = $derived.by(() => {
    const session = gazePlotterRef?.getSession()
    if (!session?.ingest.isUserDataset) return SITE_TITLE
    const unsaved = workspaceActions?.hasUnsavedWork ? '• ' : ''
    return `${unsaved}${session.workspaceFile.suggestedName} | GazePlotter`
  })

  // Once the bundled demo is on screen, say so and how to swap in real data:
  // nothing else marks these plots as sample data.
  let demoAnnounced = false
  $effect(() => {
    const session = gazePlotterRef?.getSession()
    if (dataUrl || demoAnnounced || !session) return
    if (session.ingest.status !== 'ready' || session.ingest.isUserDataset) return
    demoAnnounced = true
    session.toastState.addInfo(
      `This is demo data. Drop your own files anywhere, or ${withShortcut('use Import', 'open')}.`
    )
  })

  // After the first load settles, so the precache never competes with it.
  $effect(() => {
    const status = gazePlotterRef?.getSession().ingest.status
    if (status && status !== 'loading') registerServiceWorker()
  })

  // "?" opens the shortcut list in a new tab, so the workspace stays as it is.
  function handleHelpKey(event: KeyboardEvent): void {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return
    if (gazePlotterRef?.getSession().modalState.activeModal) return
    const target = event.target as HTMLElement | null
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return
    event.preventDefault()
    window.open(`${base}/docs/workspace/#keyboard-shortcuts`, '_blank', 'noopener')
  }

  // The browser's own prompt, only when closing would lose edits.
  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (workspaceActions?.hasUnsavedWork) event.preventDefault()
  }

  // A link to the guide stays in the page and unmounts the workspace, which
  // beforeunload never sees: ask the same question here.
  beforeNavigate(navigation => {
    if (navigation.willUnload || !workspaceActions?.hasUnsavedWork) return
    if (!window.confirm('You have unsaved changes. Leave the app and discard them?')) {
      navigation.cancel()
    }
  })

  onMount(() => {
    const session = gazePlotterRef?.getSession()
    if (session) announceVersionOnce(session.toastState)
  })
</script>

<svelte:head>
  <title>{pageTitle}</title>
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
<svelte:window onbeforeunload={handleBeforeUnload} onkeydown={handleHelpKey} />

<Header {tooltip}>
  {#snippet actions()}
    <HeaderAction
      label="Import"
      hint={`${withShortcut('Load eye-tracking data or a saved workspace', 'open')}: Tobii, SMI, Gazepoint and more`}
      {tooltip}
      icon={Upload}
      disabled={!workspaceActions?.canImport}
      onclick={() => workspaceActions?.openImport()}
    />
    <HeaderAction
      label="Export"
      hint={exportHint}
      {tooltip}
      icon={Download}
      badge={saveIndicator}
      badgeLabel={saveIndicator ? saveStatus[saveIndicator] : ''}
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
  <!-- Without JavaScript the loading card would spin forever; the guide works without it. -->
  <noscript>
    <p class="noscript">
      GazePlotter runs in your browser and needs JavaScript to open the workspace. Turn
      it on and reload, or <a href="{base}/docs/">read the guide</a>.
    </p>
  </noscript>
  <!-- The demo toast already says it loaded; a shared link keeps the success toast. -->
  <GazePlotter
    {load}
    options={{ quietInitialLoad: !dataUrl }}
    bind:this={gazePlotterRef}
    gestures="canvas"
  />
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

  .noscript {
    margin: 0;
    padding: 12px 16px;
    text-align: center;
    background: var(--c-white);
    border-bottom: 1px solid var(--c-border);
    color: var(--c-black);
  }

  .noscript a {
    color: inherit;
    text-decoration: underline;
  }
</style>
