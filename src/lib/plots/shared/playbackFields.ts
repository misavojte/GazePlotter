/**
 * The PLAYER's pane fields and settings (Scanpath, Fixation Heatmap), kept
 * apart from the runtime module so plot definitions import no clock code.
 */
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import type { SectionField } from '$lib/plots/definePlot'

/** Trail length (ms) on a video when none is set: a moving frame needs a short window. */
export const VIDEO_TRAIL_MS = 2000

/** The settings every player carries. */
export type PlaybackSettings = {
  stimulusId: number
  /** Trail length in ms: during playback only fixations within it stay on
      screen. 0 = all; unset = 2 s on a video, all on an image. */
  trailLength?: number
  /** Relative to recording time. On a shared clock, the plot that started
      playback sets it. */
  playbackSpeed: number
  /** Play on the stimulus's shared clock; off = a private one. */
  syncPlayback: boolean
}

/** Trail length in ms: the set value, else a short one on a video and all on an image. */
export function trailLengthOf(
  settings: Partial<Pick<PlaybackSettings, 'stimulusId' | 'trailLength'>>,
  engine: DataEngine
): number {
  if (settings.trailLength !== undefined) return settings.trailLength
  const media = engine.metadata?.stimuliMedia?.[settings.stimulusId ?? 0]
  return media?.kind === 'video' ? VIDEO_TRAIL_MS : 0
}

/** The Playback pane fields: trail length and speed side by side, then the sync switch. */
export const playbackPaneFields: SectionField[] = [
  {
    kind: 'number',
    key: 'trailLength',
    group: 'Playback',
    pair: true,
    label: 'Trail length (ms)',
    emptyLabel: 'All',
    min: 0,
    step: 500,
    default: 0,
    read: trailLengthOf,
  },
  {
    kind: 'enum',
    key: 'playbackSpeed',
    group: 'Playback',
    pair: true,
    label: 'Speed',
    valueKind: 'number',
    options: [
      { label: '0.25×', value: '0.25' },
      { label: '0.5×', value: '0.5' },
      { label: '1×', value: '1' },
      { label: '1.25×', value: '1.25' },
      { label: '1.5×', value: '1.5' },
      { label: '2×', value: '2' },
    ],
  },
  {
    kind: 'boolean',
    key: 'syncPlayback',
    group: 'Playback',
    label: 'Play with other plots of this stimulus',
    default: true,
  },
]
