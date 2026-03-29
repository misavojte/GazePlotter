<script lang="ts">
  import { Toaster } from '$lib/toaster'
  import { Modal } from '$lib/modals'
  import Workspace from '$lib/workspace/Workspace.svelte'
  import { Tooltip } from '$lib/tooltip'
  import { ContextMenu } from '$lib/context-menu'
  import { onMount, tick } from 'svelte'
  import {
    createGazePlotterSession,
    setGazePlotterSessionContext,
  } from '$lib/session'

  import type { GridItemSnapshot } from '$lib/workspace'
  import type { WorkspaceCommandChain } from '$lib/workspace/commands'
  import type { GazePlotterSession } from '$lib/session'

  interface Props {
    loadInitialData: (session: GazePlotterSession) => Promise<void>
    onWorkspaceCommandChain?: (command: WorkspaceCommandChain) => void
  }

  const {
    loadInitialData,
    onWorkspaceCommandChain = () => {},
  }: Props = $props()

  const session = setGazePlotterSessionContext(createGazePlotterSession())
  const { errorService } = session

  // Snapshot remains a $state rune
  let initialGridItemsSnapshot = $state<GridItemSnapshot[] | null>(null)

  async function loadData(): Promise<boolean> {
    errorService.clearFatalLoad()

    try {
      await loadInitialData(session)
      if (errorService.fatalLoad) {
        return false
      }

      initialGridItemsSnapshot = session.grid.items.map(item => ({
        ...item,
        settings: { ...item.settings },
      }))
      await tick()
      return true
    } catch (error) {
      const shouldPersistFatalLoad =
        !session.engine.hasValidData && session.grid.items.length === 0

      errorService.report({
        origin: 'bootstrap',
        severity: shouldPersistFatalLoad ? 'fatal-load' : 'recoverable',
        userMessage: 'Could not load initial workspace data.',
        cause: error,
      })
      return false
    }
  }

  /**
   * Exported function to reset the layout from parent components
   */
  export function resetLayout() {
    void loadData()
  }

  export function getSession() {
    return session
  }

  onMount(() => {
    void loadData()
  })
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
