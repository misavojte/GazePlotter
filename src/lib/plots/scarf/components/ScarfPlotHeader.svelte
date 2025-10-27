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
    source: string,
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, source, onWorkspaceCommand }: Props = $props()

</script>

<div class="nav">
  <ScarfPlotSelectStimulus {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotSelectTimeline {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotSelectGroup {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotButtonZoomIn {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotButtonZoomOut {settings} {source} {onWorkspaceCommand} />
  <ScarfPlotButtonResetView {settings} {source} {onWorkspaceCommand} />
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
