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

  interface Props {
    initialData: JsonImportNewFormat
    reinitializeLabel?: string
  }

  const { initialData, reinitializeLabel = 'Reload Demo' }: Props = $props()

  setContext('reinitializeLabel', reinitializeLabel)

  const loadData = async () => {
    processingFileStateStore.set('processing')
    data.set(initialData.data)
    initializeGridStateStore(initialData.gridItems) // HERE, THERE WILL BE AN ASYNC CALL TO INITIALIZE THE GRID STATE AND DATA
    await tick()
    processingFileStateStore.set('done')
  }

  const onReinitialize = () => {
    loadData()
  }

  const onResetLayout = () => {
    initializeGridStateStore(initialData.gridItems)
  }

  onMount(async () => {
    await loadData()
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
