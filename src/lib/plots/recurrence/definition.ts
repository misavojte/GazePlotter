import { deriveRecurrenceView } from './core/view'
import {
  StimulusSection,
  ParticipantSection,
  AoiSection,
  TimelineRangeSection,
} from '$lib/plots/shared/components/sections'
import { definePlot, type SectionFieldCtx } from '$lib/plots/definePlot'
import { stimulusParticipantSubtitle } from '$lib/plots/shared'
import { RECURRENCE_HIGHLIGHTS, RECURRENCE_MASKINGS, RECURRENCE_METHODS } from './const'
import type { RecurrencePlotSettings } from './types'

// Effective method couples the stored method with the engine capability: a
// dataset without spatial data always uses 'aoi', whatever is stored.
const effectiveMethod = (settings: Record<string, unknown>, engine: { capabilities: { spatial: boolean } }) =>
  engine.capabilities.spatial ? (settings.recurrenceMethod as string) : 'aoi'

const methodIs = (mode: string) => (ctx: SectionFieldCtx) => {
  const m = ctx.common(s => effectiveMethod(s, ctx.engine))
  return !m.mixed && m.value === mode
}

export const recurrencePlotDefinition = definePlot<
  'recurrencePlot',
  RecurrencePlotSettings
>({
  type: 'recurrencePlot',
  name: 'Recurrence Plot',
  group: 'gaze-behavior',
  paneSections: [
    { key: 'stimulus', component: StimulusSection },
    { key: 'participant', component: ParticipantSection },
    {
      key: 'recurrencePlot:method',
      title: 'Method',
      fields: [
        {
          kind: 'enum',
          key: 'recurrenceMethod',
          control: 'radio',
          direction: 'row',
          ariaLabel: 'Recurrence method',
          // Spatial methods need spatial data; without it only AOI remains.
          options: ctx =>
            ctx.engine.capabilities.spatial
              ? RECURRENCE_METHODS
              : RECURRENCE_METHODS.filter(m => m.value === 'aoi'),
          read: effectiveMethod,
          summary: true,
        },
        {
          kind: 'number',
          key: 'radius',
          label: 'Radius [px]',
          min: 1,
          max: 500,
          showWhen: methodIs('fixedDistance'),
        },
        {
          kind: 'number',
          key: 'gridSize',
          label: 'Cells per axis',
          min: 2,
          max: 100,
          showWhen: methodIs('fixedGrid'),
        },
        { kind: 'boolean', key: 'showDuration', label: 'Duration weighting' },
        { kind: 'number', key: 'minLineLength', label: 'Min line length', min: 2, max: 20 },
      ],
    },
    {
      key: 'recurrencePlot:visualisation',
      title: 'Visualisation',
      fields: [
        {
          kind: 'enum',
          key: 'highlight',
          control: 'radio',
          label: 'Highlight',
          options: RECURRENCE_HIGHLIGHTS,
        },
        {
          kind: 'enum',
          key: 'masking',
          control: 'radio',
          label: 'Masking',
          options: RECURRENCE_MASKINGS,
        },
      ],
      summary: ctx => {
        const highlight = ctx.common(s => s.highlight)
        const masking = ctx.common(s => s.masking)
        if (highlight.mixed || masking.mixed) return 'Mixed'
        const hl = highlight.value
        const hlLabel =
          hl === 'none' ? '' : hl === 'diagonal' ? 'Diagonal' : hl === 'horizontal' ? 'Horizontal' : 'Vertical'
        const maskLabel =
          masking.value === 'none' ? '' : masking.value === 'diagonal' ? 'No main diag.' : 'Upper'
        if (!hlLabel && !maskLabel) return 'Standard'
        if (hlLabel && maskLabel) return `${hlLabel} (${maskLabel})`
        return hlLabel || maskLabel
      },
    },
    { key: 'timelineRange', component: TimelineRangeSection },
    { key: 'aoi', component: AoiSection },
  ],
  view: { deriveView: deriveRecurrenceView },
  getSubtitle: stimulusParticipantSubtitle,
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    participantId: 0,
    recurrenceMethod: 'fixedDistance',
    radius: 50,
    gridSize: 10,
    showDuration: false,
    minLineLength: 2,
    highlight: 'none',
    masking: 'diagonal',
  }),
  getMinSize: () => ({ w: 11, h: 10 }),
  getDefaultHeight: () => 12,
  getDefaultWidth: () => 12,
  requireCapabilities: ['segmented'],
})
