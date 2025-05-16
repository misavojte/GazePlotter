<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonScanGraph from '$lib/workspace/panel/components/PanelButtonScanGraph.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import PanelButtonExportWorkplace from '$lib/workspace/panel/components/PanelButtonExportWorkplace.svelte'

  interface Props {
    onReinitialize: () => void
  }

  const { onReinitialize }: Props = $props()
</script>

<div class="controls">
  <PanelButtonUpload />
  <PanelButtonDemo {onReinitialize} />
  <PanelButtonExportWorkplace />
  <PanelButtonScanGraph />
</div>

<style>
  .controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 5px;
    margin-bottom: 25px;
  }
</style>
