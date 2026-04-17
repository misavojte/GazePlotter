<script lang="ts">
  import {
    PlotMenuButton,
    createAoiCustomizationMenuAction,
    createParticipantsGroupsMenuAction,
    createPlotMenuErrorContext,
    createPlotMenuDivider,
    createPlotModalAction,
    createStimulusCustomizationMenuAction,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import Download from 'lucide-svelte/icons/download'
  import Table from 'lucide-svelte/icons/table'
  import { downloadPlotModal } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'
  import type { MetricCorrelationItem } from '../types'
  import { getMetricCorrelationData } from '../core/transformer'
  import { downloadCorrelationCsv } from '../core/exportCsv'

  interface Props {
    item: MetricCorrelationItem
  }

  let { item }: Props = $props()
  const { engine, errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  function handleCsvExport() {
    try {
      const result = getMetricCorrelationData(engine, settings, {
        includePoints: false,
      })
      downloadCorrelationCsv(result, settings)
    } catch (error) {
      errorService.report({
        origin: 'plot',
        severity: 'recoverable',
        userMessage: 'Could not export correlation table.',
        cause: error,
        context: { itemId: item.id, plotType: item.type },
      })
    }
  }

  let items = $derived([
    createAoiCustomizationMenuAction({
      openModal,
      source,
      stimulusId: settings.stimulusId,
      errorContext,
    }),
    createStimulusCustomizationMenuAction({
      openModal,
      source,
      errorContext,
    }),
    createParticipantsGroupsMenuAction({
      openModal,
      source,
      errorContext,
    }),
    createPlotMenuDivider(),
    {
      label: 'Export correlation table (CSV)',
      icon: Table,
      onAction: handleCsvExport,
    },
    createPlotModalAction({
      openModal,
      definition: downloadPlotModal,
      props: {
        item,
      },
      label: 'Download plot',
      icon: Download,
      errorContext,
    }),
  ])
</script>

<PlotMenuButton {items} />
