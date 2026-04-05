<script lang="ts">
  import {
    PlotMenuButton,
    createAoiCustomizationMenuAction,
    createEventChannelCustomizationMenuAction,
    createParticipantCustomizationMenuAction,
    createParticipantsGroupsMenuAction,
    createPlotMenuErrorContext,
    createPlotMenuDivider,
    createPlotModalAction,
    createStimulusCustomizationMenuAction,
  } from '$lib/plots/shared'
  import { getGazePlotterSession } from '$lib/session'
  import Download from 'lucide-svelte/icons/download'
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import {
    downloadPlotModal,
    exportSegmentedDataModal,
  } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)
  const openModal = modalState.open.bind(modalState)
  const errorContext = createPlotMenuErrorContext(errorService, () => item)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  const items = $derived([
    createAoiCustomizationMenuAction({
      openModal,
      source,
      stimulusId: settings.stimulusId,
      errorContext,
    }),
    createEventChannelCustomizationMenuAction({
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
    createParticipantCustomizationMenuAction({
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
      definition: exportSegmentedDataModal,
      props: {},
      icon: Download,
      errorContext,
    }),
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

