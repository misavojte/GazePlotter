import type { PaneSection } from '$lib/plots/definePlot'
import StimulusSection from './StimulusSection.svelte'
import GroupSection from './GroupSection.svelte'
import ParticipantSection from './ParticipantSection.svelte'
import AoiSection from './AoiSection.svelte'
import EventSection from './EventSection.svelte'
import EyeMovementSection from './EyeMovementSection.svelte'
import MetricSection from './MetricSection.svelte'
import TimelineRangeSection from '../TimelineRangeSection.svelte'

export {
  StimulusSection,
  GroupSection,
  ParticipantSection,
  AoiSection,
  EventSection,
  EyeMovementSection,
  MetricSection,
  TimelineRangeSection,
}
export { computeCommonValue, editTargets, createBulkContext } from './common'

/**
 * Cross-type-safe shared sections, keyed by canonical section key. The
 * multi-select Pane renders these for the section keys common to ALL selected
 * plot types. `metric` is intentionally absent — its contract is type-specific,
 * so it only appears in a single / same-type pane (via each plot's own entry).
 */
export const SHARED_SECTIONS: Record<string, PaneSection> = {
  stimulus: StimulusSection,
  group: GroupSection,
  participant: ParticipantSection,
  timelineRange: TimelineRangeSection as unknown as PaneSection,
  aoi: AoiSection,
  event: EventSection,
  eyeMovement: EyeMovementSection,
}
