import RecurrencePlot from './components/RecurrencePlot.svelte'
import RecurrenceExportFigure from './components/RecurrenceExportFigure.svelte'
import { definePlot } from '$lib/plots/definePlot'
import type { RecurrencePlotSettings } from './types'

export const recurrencePlotDefinition = definePlot<
  'recurrencePlot',
  RecurrencePlotSettings
>({
  type: 'recurrencePlot',
  name: 'Recurrence Plot',
  component: RecurrencePlot,
  export: { figure: RecurrenceExportFigure },
  getDefaultSettings: (params = {}) => ({
    stimulusId: params.stimulusId ?? 0,
    groupId: params.groupId ?? -1,
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
  requireCapabilities: ['segmented', 'spatial'],
})
