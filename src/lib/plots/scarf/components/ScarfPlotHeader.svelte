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
  import type { WorkspaceInstruction } from '$lib/shared/types/workspaceInstructions'
  
  interface Props {
    settings: ScarfGridType
    settingsChange: (settings: Partial<ScarfGridType>) => void
    onInstruction: (instruction: WorkspaceInstruction) => void
  }

  let { settings, settingsChange, onInstruction }: Props = $props()

  function handleSettingsChange(newSettings: Partial<ScarfGridType>) {
    if (settingsChange) {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      }

      settingsChange(updatedSettings)
    }
  }
</script>

<div class="nav">
  <ScarfPlotSelectStimulus {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotSelectTimeline {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotSelectGroup {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotButtonZoomIn {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotButtonZoomOut {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotButtonResetView {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotButtonMenu
    {settings}
    {onInstruction}
    settingsChange={handleSettingsChange}
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
