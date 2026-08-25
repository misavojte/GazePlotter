import { deriveScanpathView } from './core/view'
import { plotCursorScreen } from '$lib/plots/shared/plotCursor.svelte'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { stimulusParticipantSubtitle } from '$lib/plots/shared'
import { PRESET_PALETTES } from '$lib/color/palettes'
import type { ScanpathPlotSettings } from './types'

const colorModeIs = (mode: string) => (ctx: SectionFieldCtx) => {
  const v = ctx.common(s => s.colorMode ?? 'time')
  return !v.mixed && v.value === mode
}

export const scanpathPlotDefinition = definePlot<'scanpath', ScanpathPlotSettings>({
  type: 'scanpath',
  name: 'Scanpath',
  group: 'gaze-behavior',
  paneSections: [
    'stimulus',
    'participant',
    {
      key: 'scanpath:visualisation',
      title: 'Visualisation',
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
          defaultMin: PRESET_PALETTES.VIRIDIS.colors[0],
          defaultMax: PRESET_PALETTES.VIRIDIS.colors[2],
          showWhen: colorModeIs('time'),
        },
        { kind: 'boolean', key: 'showFixationOrder', label: 'Show fixation order line' },
        { kind: 'boolean', key: 'showNumbers', label: 'Show fixation numbers' },
        {
          kind: 'number',
          key: 'playbackWindow',
          group: 'Playback',
          pair: true,
          label: 'Window (ms, 0 shows all)',
          min: 0,
          step: 500,
          default: 0,
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
      ],
    },
  ],
  view: { deriveView: deriveScanpathView },
  screen: plotCursorScreen(),
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
    playbackWindow: 0,
    playbackSpeed: 1,
  }),
  size: { min: { w: 12, h: 10 }, w: 16 },
  requireCapabilities: [['segmented', 'spatial']],
})
