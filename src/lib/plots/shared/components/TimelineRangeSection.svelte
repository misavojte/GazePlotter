<script lang="ts" generics="TType extends PlotType, TSettings extends { timelineStart?: number; timelineEnd?: number }">
  /**
   * The "Time range [ms]" section every metric-consuming plot pane carries.
   *
   * Four PaneSettings used to repeat the same `<PaneSection title="Time range [ms]">`
   * + two `<InputNumber>` block (start / end-or-auto). This wraps it into one
   * line per pane. The "End (0 = Auto)" convention now lives in one place.
   *
   * Only renders if the plot's settings type carries `timelineStart` /
   * `timelineEnd` — the generic constraint enforces it at the call site.
   */
  import { InputNumber } from '$lib/shared/components'
  import { PaneSection } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import type { PlotItemContract } from '../../definePlot'
  import type { PlotType } from '$lib/workspace'

  interface Props {
    item: PlotItemContract<TType, TSettings>
  }

  let { item }: Props = $props()

  const { workspace } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const source = $derived(createCommandSourcePlotPattern(item, 'pane'))

  function update(patch: Partial<TSettings>): void {
    workspace.updateItemSettings(item.id, patch, source)
  }

  // Stable per-plot ids to keep label associations correct when multiple
  // panes mount simultaneously (e.g. side-by-side tab views).
  const startId = $derived(`timeline-start-${item.type}-${item.id}`)
  const endId = $derived(`timeline-end-${item.type}-${item.id}`)
</script>

<PaneSection title="Time range [ms]">
  <div class="inline-pair">
    <InputNumber
      id={startId}
      label="Start"
      value={settings.timelineStart}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v =>
        update({ timelineStart: v } as Partial<TSettings>)}
    />
    <InputNumber
      id={endId}
      label="End (0 = Auto)"
      value={settings.timelineEnd}
      min={0}
      appearance="compact"
      allowEmpty={true}
      onValueChange={v =>
        update({ timelineEnd: v } as Partial<TSettings>)}
    />
  </div>
</PaneSection>

<style>
  .inline-pair {
    display: flex;
    gap: 8px;
  }
</style>
