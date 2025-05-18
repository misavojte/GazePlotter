<script lang="ts">
  import Toaster from '$lib/toaster/components/Toaster.svelte'
  import { Modal } from '$lib/modals'
  import Panel from '$lib/workspace/panel/components/Panel.svelte'
  import Workspace from '$lib/workspace/components/Workspace.svelte'
  import Tooltip from '$lib/tooltip/components/Tooltip.svelte'
  import type { JsonImportNewFormat } from '$lib/gaze-data/shared/types'
  import { onMount, tick } from 'svelte'
  import {
    initializeGridStateStore,
    processingFileStateStore,
  } from './workspace'
  import { data } from './gaze-data/front-process/stores/dataStore'
  import { setContext } from 'svelte'
  import { addSuccessToast } from '$lib/toaster'

  interface Props {
    loadInitialData: () => Promise<JsonImportNewFormat>
    reinitializeLabel?: string
  }

  const { loadInitialData, reinitializeLabel = 'Reload Demo' }: Props = $props()

  setContext('reinitializeLabel', reinitializeLabel)

  async function loadData() {
    processingFileStateStore.set('processing')
    try {
      const initialData = await loadInitialData()
      console.log('initialData', initialData)
      data.set(initialData.data)
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
      const initialData = await loadInitialData()
      initializeGridStateStore(initialData.gridItems)
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
  <Workspace {onReinitialize} {onResetLayout} />
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
