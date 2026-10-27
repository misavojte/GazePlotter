import { deriveScanpathView, scanpathTrail } from './core/view'
import { scanpathScreen } from './core/screen.svelte'
import { commonIs, definePlot } from '$lib/plots/definePlot'
import { stimulusParticipantSubtitle } from '$lib/plots/shared'
import { PRESET_PALETTES } from '$lib/color/palettes'
import { stimulusBackgroundField } from '$lib/plots/shared/stimulusBackground'
import { SCANPATH_COLORS } from './const'
import type { ScanpathPlotSettings } from './types'

export const scanpathPlotDefinition = definePlot<'scanpath', ScanpathPlotSettings>({
  type: 'scanpath',
  name: 'Scanpath',
  tagline: 'Fixation path of one participant',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'participant',
    {
      key: 'scanpath:visualization',
      title: 'Visualization',
      fields: [
        {
          kind: 'enum',
          key: 'colorMode',
          group: 'Fixation color',
          options: [
            { label: 'Time gradient', value: 'time' },
            { label: 'Solid', value: 'solid' },
          ],
          summary: true,
        },
        {
          kind: 'colorScale',
          key: 'colorScale',
          group: 'Fixation color',
          defaultMin: PRESET_PALETTES.VIRIDIS.colors[0],
          defaultMax: PRESET_PALETTES.VIRIDIS.colors[2],
          showWhen: commonIs(s => s.colorMode ?? 'time', 'time'),
        },
        {
          kind: 'color',
          key: 'solidColor',
          group: 'Fixation color',
          label: 'Color',
          default: SCANPATH_COLORS.fixationFill,
          showWhen: commonIs(s => s.colorMode ?? 'time', 'solid'),
        },
        stimulusBackgroundField(['image', 'video']),
        { kind: 'boolean', key: 'showFixationOrder', label: 'Show fixation order line' },
        { kind: 'boolean', key: 'showNumbers', label: 'Show fixation numbers' },
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
          read: scanpathTrail,
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
      ],
    },
    'timelineRange',
  ],
  view: { deriveView: deriveScanpathView },
  screen: scanpathScreen,
  getSubtitle: stimulusParticipantSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    participantId: 0,
    showFixationOrder: true,
    showNumbers: true,
    // Old workspaces lack these keys; the item factory merges the defaults
    // in, so no migration is needed.
    colorMode: 'time',
    colorScale: [...PRESET_PALETTES.VIRIDIS.colors],
    solidColor: SCANPATH_COLORS.fixationFill,
    background: 'image',
    playbackSpeed: 1,
    syncPlayback: true,
  }),
  size: { min: { w: 12, h: 10 }, w: 16 },
  requireCapabilities: [['segmented', 'spatial']],
})
