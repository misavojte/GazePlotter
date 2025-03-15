<script lang="ts">
  import ZoomInButton from '../ScarfPlotButton/ScarfPlotButtonZoomIn.svelte'
  import ZoomOutButton from '../ScarfPlotButton/ScarfPlotButtonZoomOut.svelte'
  import ScarfPlotSelectStimulus from '../ScarfPlotSelect/ScarfPlotSelectStimulus.svelte'
  import ScarfPlotButtonMenu from '../ScarfPlotButton/ScarfPlotButtonMenu.svelte'
  import ScarfTimelineSelect from '../ScarfPlotSelect/ScarfPlotSelectTimeline.svelte'
  import ScarfPlotSelectGroup from '../ScarfPlotSelect/ScarfPlotSelectGroup.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'

  export let settings: ScarfGridType
</script>

<div class="nav">
  <ScarfPlotSelectStimulus bind:settings />
  <ScarfTimelineSelect bind:settings />
  <ScarfPlotSelectGroup bind:settings />
  <ZoomInButton bind:settings />
  <ZoomOutButton bind:settings />
  <ScarfPlotButtonMenu bind:settings />
</div>

<style>
  .nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
