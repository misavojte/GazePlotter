<script>
import PanelButtonUpload from './PanelButton/PanelButtonUpload.svelte'
import PanelButtonScanGraph from './PanelButton/PanelButtonScanGraph.svelte'
import PanelButtonDemo from './PanelButton/PanelButtonDemo.svelte'
import PanelButtonExportWorkplace from './PanelButton/PanelButtonExportWorkplace.svelte'
</script>

<div class="controls">
    <PanelButtonUpload />
    <PanelButtonDemo />
    <PanelButtonExportWorkplace />
    <PanelButtonScanGraph />
</div>

<style>
.controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
    height: 100%;
    gap: 5px;
    margin-bottom: 25px;
}
</style>
