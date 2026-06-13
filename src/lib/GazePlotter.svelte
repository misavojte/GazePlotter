<script lang="ts">
  import { Toaster } from '$lib/toaster'
  import { Modal } from '$lib/modals'
  import Workspace from '$lib/workspace/Workspace.svelte'
  import { Tooltip } from '$lib/tooltip'
  import { ContextMenu } from '$lib/context-menu'
  import { onMount } from 'svelte'
  import {
    createGazePlotterSession,
    setGazePlotterSessionContext,
  } from '$lib/session'

  import type { GridItemSnapshot } from '$lib/workspace'
  import type { WorkspaceCommandChain } from '$lib/workspace/commands'
  import type { DataLoader } from '$lib/data/ingest'

  interface Props {
    /**
     * Prepares the initial files for this session. Same pipeline as drag-drop
     * / upload button — see {@link DataLoader} for the contract (return
     * `File[]`, throw `Error` with a user-facing message, honour the signal).
     *
     * Called once when the component mounts. The library does **not** track
     * this prop reactively; passing a different function later has no effect.
     * To re-run the load, call `resetLayout()` on the bound instance, or wrap
     * `<GazePlotter>` in `{#key value}` to remount.
     */
    load: DataLoader
    onWorkspaceCommandChain?: (command: WorkspaceCommandChain) => void
  }

  const { load, onWorkspaceCommandChain = () => {} }: Props = $props()

  const session = setGazePlotterSessionContext(createGazePlotterSession())
  const { errorService, ingest } = session

  let initialGridItemsSnapshot = $state<GridItemSnapshot[] | null>(null)
  let activeAbort: AbortController | null = null
  let loadGeneration = 0

  async function runLoad(
    loader: DataLoader,
    signal: AbortSignal,
    generation: number
  ): Promise<void> {
    errorService.clearFatalLoad()

    let files: File[]
    try {
      files = await loader(signal)
    } catch (cause) {
      if (generation !== loadGeneration || signal.aborted) return
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not load initial workspace data.'
      errorService.report({
        origin: 'bootstrap',
        severity: 'fatal-load',
        userMessage: message,
        cause,
      })
      return
    }

    if (generation !== loadGeneration || signal.aborted) return

    if (files.length === 0) {
      ingest.applyEmpty()
    } else {
      await ingest.loadFiles(files)
    }
    if (generation !== loadGeneration || signal.aborted) return
    if (errorService.fatalLoad) return

    initialGridItemsSnapshot = session.grid.items.map(item => ({
      ...item,
      settings: { ...item.settings },
    }))
  }

  function startLoad(): void {
    activeAbort?.abort()
    const controller = new AbortController()
    activeAbort = controller
    const generation = ++loadGeneration
    void runLoad(load, controller.signal, generation)
  }

  onMount(() => {
    startLoad()
    return () => {
      activeAbort?.abort()
    }
  })

  export function resetLayout() {
    startLoad()
  }

  export function getSession() {
    return session
  }
</script>

<div id="GP-gazeplotter">
  <Workspace
    {onWorkspaceCommandChain}
    initialLayoutState={initialGridItemsSnapshot}
  />

  <Modal />
  <Toaster />
  <Tooltip />
  <ContextMenu />
</div>

<style>
  #GP-gazeplotter {
    font-family: inherit;
    font-size: 16px;
    line-height: 1.5;
    color: var(--c-black);
  }
</style>
