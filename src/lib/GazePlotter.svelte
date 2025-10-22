<script lang="ts">
  import Toaster from '$lib/toaster/components/Toaster.svelte'
  import { Modal } from '$lib/modals'
  import Panel from '$lib/workspace/panel/components/Panel.svelte'
  import Workspace from '$lib/workspace/components/Workspace.svelte'
  import Tooltip from '$lib/tooltip/components/Tooltip.svelte'
  import type { ParsedData } from '$lib/gaze-data/shared/types'
  import { onMount, tick } from 'svelte'
  import {
    initializeGridStateStore,
    processingFileStateStore,
  } from './workspace'
  import { data } from './gaze-data/front-process/stores/dataStore'
  import { setContext } from 'svelte'
  import { addSuccessToast } from '$lib/toaster'
  import {
    fileMetadataStore,
    currentFileInputStore,
  } from './workspace/stores/fileStore'
  import type { AllGridTypes } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    loadInitialData: () => Promise<ParsedData>
    reinitializeLabel?: string
    onWorkspaceCommandChain?: (command: WorkspaceCommandChain) => void
  }

  const { loadInitialData, reinitializeLabel = 'Reload Demo', onWorkspaceCommandChain = (command: WorkspaceCommandChain) => {
    console.log('onWorkspaceCommandChain', command)
  } }: Props = $props()

  setContext('reinitializeLabel', reinitializeLabel)

  // Cache the initial grid layout to avoid reloading data when only resetting layout
  let initialGridItemsSnapshot: Array<Partial<AllGridTypes> & { type: string }> | null = null

  async function loadData() {
    processingFileStateStore.set('processing')
    try {
      const initialData = await loadInitialData()
      data.set(initialData.data)
      // Capture the initial grid items so Reset layout can restore without reloading data
      initialGridItemsSnapshot = initialData.gridItems
      if (initialData.version === 3) {
        fileMetadataStore.set(initialData.fileMetadata)
      } else {
        fileMetadataStore.set(null)
      }
      currentFileInputStore.set(initialData.current)
      initializeGridStateStore(initialData.gridItems)
      await tick()
      processingFileStateStore.set('done')
    } catch (error) {
      console.error('Error loading data:', error)
      processingFileStateStore.set('fail')
    }
  }

  const onReinitialize = () => {
    loadData().then(() => {
      addSuccessToast('Workspace and data returned to the initial state.')
    })
  }

  const onResetLayout = async () => {
    try {
      // Restore the grid layout from the cached snapshot without reloading data
      initializeGridStateStore(initialGridItemsSnapshot)
      addSuccessToast('Workspace layout returned to the initial state.')
    } catch (error) {
      console.error('Error resetting layout:', error)
    }
  }

  onMount(() => {
    loadData()
  })
</script>

<div id="GP-gazeplotter">
  <div class="panel-container">
    <Panel {onReinitialize} />
  </div>
  <Workspace {onReinitialize} {onResetLayout} {onWorkspaceCommandChain} />
  <Modal />
  <Toaster />
  <Tooltip />
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
