<script lang="ts">
  import { Toaster } from '$lib/toaster'
  import { Modal } from '$lib/modals'
  import DesignTokens from '$lib/DesignTokens.svelte'
  import Workspace from '$lib/workspace/Workspace.svelte'
  import { Tooltip } from '$lib/tooltip'
  import { ContextMenu } from '$lib/context-menu'
  import { onDestroy, onMount } from 'svelte'
  import {
    createGazePlotterSession,
    setGazePlotterSessionContext,
    type GazePlotterOptions,
  } from '$lib/session'

  import type { WorkspaceCommandChain } from '$lib/workspace/commands'
  import { WorkspaceCamera } from '$lib/workspace/camera.svelte'
  import {
    createWorkspaceActions,
    type WorkspaceActions,
  } from '$lib/workspace/actions.svelte'
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
    /** Read once on mount; see {@link GazePlotterOptions}. */
    options?: GazePlotterOptions
    onWorkspaceCommandChain?: (command: WorkspaceCommandChain) => void
    /**
     * How the mouse wheel behaves over the workspace.
     * - `'cooperative'` (default, for a workspace embedded in a scrolling
     *   page): the wheel scrolls the page; Ctrl/Cmd+wheel zooms.
     * - `'canvas'` (for a host that gives GazePlotter the whole screen): the
     *   wheel pans the workspace; Ctrl/Cmd+wheel zooms.
     */
    gestures?: 'cooperative' | 'canvas'
    /**
     * Show the built-in floating controls on the workspace (add plot,
     * undo/redo, reset layout, zoom). Turn off to drive everything from your
     * own UI through `getActions()`.
     */
    controls?: boolean
  }

  const {
    load,
    options,
    onWorkspaceCommandChain = () => {},
    gestures = 'cooperative',
    controls = true,
  }: Props = $props()

  // svelte-ignore state_referenced_locally -- read once by design (see prop doc)
  const session = setGazePlotterSessionContext(createGazePlotterSession(options))
  const { errorService, ingest } = session
  const camera = new WorkspaceCamera()
  const actions = createWorkspaceActions(session, camera)
  onDestroy(() => camera.destroy())

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

  /**
   * Import, export, metadata, history and zoom, for the host's own buttons:
   * GazePlotter renders no top bar. See {@link WorkspaceActions}.
   */
  export function getActions(): WorkspaceActions {
    return actions
  }
</script>

<DesignTokens colors={options?.colors} />

<div id="GP-gazeplotter">
  <Workspace {onWorkspaceCommandChain} {camera} {gestures} {controls} />

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
