<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonDemo from '$lib/workspace/panel/components/PanelButtonDemo.svelte'
  import PanelButtonExportWorkspace from '$lib/workspace/panel/components/PanelButtonExportWorkspace.svelte'

  interface Props {
    onReinitialize: () => void
  }

  const { onReinitialize }: Props = $props()
</script>

<div class="controls">
  <PanelButtonUpload />
  <PanelButtonDemo {onReinitialize} />
  <PanelButtonExportWorkspace />
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
    padding-left: 40px;
    box-sizing: border-box;
  }
</style>
