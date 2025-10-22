<script lang="ts">
  import {
    ScarfPlotSelectStimulus,
    ScarfPlotSelectTimeline,
    ScarfPlotSelectGroup,
    ScarfPlotButtonMenu,
    ScarfPlotButtonZoomIn,
    ScarfPlotButtonZoomOut,
    ScarfPlotButtonResetView,
  } from '$lib/plots/scarf/components'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  
  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

</script>

<div class="nav">
  <ScarfPlotSelectStimulus {settings} {onWorkspaceCommand} />
  <ScarfPlotSelectTimeline {settings} {onWorkspaceCommand} />
  <ScarfPlotSelectGroup {settings} {onWorkspaceCommand} />
  <ScarfPlotButtonZoomIn {settings} {onWorkspaceCommand} />
  <ScarfPlotButtonZoomOut {settings} {onWorkspaceCommand} />
  <ScarfPlotButtonResetView {settings} {onWorkspaceCommand} />
  <ScarfPlotButtonMenu
    {settings}
    {onWorkspaceCommand}
  />
</div>

<style>
  .nav {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    background: inherit;
  }
</style>
