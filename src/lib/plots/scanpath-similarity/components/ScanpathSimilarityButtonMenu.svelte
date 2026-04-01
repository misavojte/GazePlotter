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
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import type { ScanpathSimilarityItem } from '../types'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import Download from 'lucide-svelte/icons/download'
  import {
    downloadScanpathSimilarityPlotModal,
    exportScanpathSimilarityModal,
  } from '$lib/modals/definitions'

  interface Props {
    item: ScanpathSimilarityItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(
    untrack(() => item),
    'modal'
  )

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
    createPlotModalAction({
      openModal,
      definition: exportScanpathSimilarityModal,
      props: {
        item,
      },
      icon: Download,
      errorContext,
    }),
    createPlotModalAction({
      openModal,
      definition: downloadScanpathSimilarityPlotModal,
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
