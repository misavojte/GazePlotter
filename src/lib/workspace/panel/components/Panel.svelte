<script lang="ts">
  import PanelButtonUpload from '$lib/workspace/panel/components/PanelButtonUpload.svelte'
  import PanelButtonExportWorkspace from '$lib/workspace/panel/components/PanelButtonExportWorkspace.svelte'
</script>

<div class="controls">
  <PanelButtonUpload />
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
