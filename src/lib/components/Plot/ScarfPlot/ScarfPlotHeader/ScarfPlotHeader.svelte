<script lang="ts">
  import ZoomInButton from '../ScarfPlotButton/ScarfPlotButtonZoomIn.svelte'
  import ZoomOutButton from '../ScarfPlotButton/ScarfPlotButtonZoomOut.svelte'
  import ScarfPlotSelectStimulus from '../ScarfPlotSelect/ScarfPlotSelectStimulus.svelte'
  import ScarfPlotButtonMenu from '../ScarfPlotButton/ScarfPlotButtonMenu.svelte'
  import ScarfTimelineSelect from '../ScarfPlotSelect/ScarfPlotSelectTimeline.svelte'
  import ScarfPlotSelectGroup from '../ScarfPlotSelect/ScarfPlotSelectGroup.svelte'

  export let scarfId: number
</script>

<div class="nav">
  <ScarfPlotSelectStimulus {scarfId} />
  <ScarfTimelineSelect {scarfId} />
  <ScarfPlotSelectGroup {scarfId} />
  <ZoomInButton {scarfId} />
  <ZoomOutButton {scarfId} />
  <ScarfPlotButtonMenu {scarfId} />
</div>

<style>
  .nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
