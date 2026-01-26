<script lang="ts">
  import { Toaster } from '$lib/toaster'
  import { Modal } from '$lib/modals'
  import Panel from '$lib/workspace/panel/components/Panel.svelte'
  import Workspace from '$lib/workspace/components/Workspace.svelte'
  import { Tooltip } from '$lib/tooltip'
  import { ContextMenu } from '$lib/context-menu'
  import type { ParsedData } from '$lib/data/types'
  import { onMount, tick, setContext } from 'svelte'

  // NEW: Import the unified grid instance
  import { grid } from '$lib/workspace/grid'

  import { clear } from './workspace'
  import { fileState } from '$lib/file.state.svelte'
  import { engine } from '$lib/data/engine'
  import { addSuccessToast } from '$lib/toaster'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommandChain } from '$lib/workspace/commands'

  interface Props {
    loadInitialData: () => Promise<ParsedData>
    reinitializeLabel?: string
    onWorkspaceCommandChain?: (command: WorkspaceCommandChain) => void
  }

  const {
    loadInitialData,
    reinitializeLabel = 'Reload Demo',
    onWorkspaceCommandChain = (command: WorkspaceCommandChain) => {
      console.log('onWorkspaceCommandChain', command)
    },
  }: Props = $props()

  setContext('reinitializeLabel', reinitializeLabel)

  // Snapshot remains a $state rune
  let initialGridItemsSnapshot = $state<Array<
    Partial<AllGridTypes> & { type: string }
  > | null>(null)

  async function loadData() {
    // Svelte 5 logic: Use class properties for loading states where possible
    // but keep legacy stores if they haven't been migrated to .svelte.ts yet
    fileState.processing = 'processing'

    try {
      const initialData = await loadInitialData()

      // Update global data via Engine (Source of Truth)
      engine.loadDataset(initialData.data)

      // Capture the initial grid items for Reset layout
      initialGridItemsSnapshot = initialData.gridItems as Array<
        Partial<AllGridTypes> & { type: string }
      >

      // Metadata handling
      if (initialData.version === 3) {
        fileState.metadata = initialData.fileMetadata
      } else {
        fileState.metadata = null
      }

      fileState.input = initialData.current

      // CRITICAL CHANGE: Instead of initializeGridStateStore(initialData.gridItems),
      // we use the class's reset method directly.
      grid.reset(initialData.gridItems as any)

      await tick()
      fileState.processing = 'done'
    } catch (error) {
      console.error('Error loading data:', error)
      fileState.processing = 'fail'
    }
  }

  const onReinitialize = () => {
    loadData().then(() => {
      addSuccessToast('Workspace and data returned to the initial state.')
    })
    // clear() should now handle resetting history/undo-redo
    clear()
  }

  /**
   * Exported function to reset the layout from parent components
   */
  export function resetLayout() {
    loadData()
    clear()
  }

  onMount(() => {
    loadData()
  })
</script>

<div id="GP-gazeplotter">
  <div class="panel-container">
    <Panel {onReinitialize} />
  </div>

  <Workspace
    {onReinitialize}
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
  .panel-container {
    max-width: 1220px;
    margin-inline: auto;
    margin-block: 40px;
  }
</style>
