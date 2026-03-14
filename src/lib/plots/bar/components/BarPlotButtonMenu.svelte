<script lang="ts">
  import { PlotMenuButton } from '$lib/plots/shared'
  import { getModalState } from '$lib/session'
  import type { BarPlotItem } from '$lib/plots/bar/types'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import {
    aoiModificationModal,
    participantsGroupsModal,
    downloadBarPlotModal,
    stimulusModificationModal,
    exportAggregatedDataModal,
  } from '$lib/modals/definitions'
  import type { ComponentProps } from 'svelte'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: BarPlotItem
  }

  let { item }: Props = $props()
  const modalState = getModalState()
  const settings = $derived(item.settings)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  const openAoiModificationModal = () => {
    modalState.open(aoiModificationModal, {
      selectedStimulus: settings.stimulusId.toString(),
      source,
    })
  }

  const openStimulusModificationModal = () => {
    modalState.open(stimulusModificationModal, {
      source,
    })
  }

  const openUserGroupsModal = () => {
    modalState.open(participantsGroupsModal, {
      source,
    })
  }

  const downloadPlot = () => {
    modalState.open(downloadBarPlotModal, {
      item,
    })
  }

  const exportAggregatedData = () => {
    modalState.open(exportAggregatedDataModal, {
      item,
    })
  }

  let items = $derived([
    {
      label: 'AOI customization',
      action: openAoiModificationModal,
      icon: Settings,
    },
    {
      label: 'Stimulus customization',
      action: openStimulusModificationModal,
      icon: Settings,
    },
    {
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    { isDivider: true },
    {
      label: 'Export aggregated data',
      action: exportAggregatedData,
      icon: Download,
    },
    {
      label: 'Download plot',
      action: downloadPlot,
      icon: Download,
    },
  ] as ComponentProps<typeof PlotMenuButton>['items'])
</script>

<PlotMenuButton {items} />
