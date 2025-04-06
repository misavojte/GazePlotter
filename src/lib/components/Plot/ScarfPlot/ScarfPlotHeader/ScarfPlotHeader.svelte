<script lang="ts">
  import ZoomInButton from '../ScarfPlotButton/ScarfPlotButtonZoomIn.svelte'
  import ZoomOutButton from '../ScarfPlotButton/ScarfPlotButtonZoomOut.svelte'
  import ResetViewButton from '../ScarfPlotButton/ScarfPlotButtonResetView.svelte'
  import ScarfPlotSelectStimulus from '../ScarfPlotSelect/ScarfPlotSelectStimulus.svelte'
  import ScarfPlotButtonMenu from '../ScarfPlotButton/ScarfPlotButtonMenu.svelte'
  import ScarfTimelineSelect from '../ScarfPlotSelect/ScarfPlotSelectTimeline.svelte'
  import ScarfPlotSelectGroup from '../ScarfPlotSelect/ScarfPlotSelectGroup.svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import type { ScarfFillingType } from '$lib/type/Filling/ScarfFilling/ScarfFillingType'
  interface Props {
    settings: ScarfGridType
    scarfData: ScarfFillingType
    settingsChange: (settings: Partial<ScarfGridType>) => void
  }

  let { settings, scarfData, settingsChange }: Props = $props()

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
  <ScarfTimelineSelect {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotSelectGroup {settings} settingsChange={handleSettingsChange} />
  <ZoomInButton {settings} settingsChange={handleSettingsChange} />
  <ZoomOutButton {settings} settingsChange={handleSettingsChange} />
  <ResetViewButton {settings} settingsChange={handleSettingsChange} />
  <ScarfPlotButtonMenu
    {settings}
    {scarfData}
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
