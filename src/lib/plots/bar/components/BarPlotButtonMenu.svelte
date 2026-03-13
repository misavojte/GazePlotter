<script lang="ts">
  import { PlotMenuButton } from '$lib/plots/shared'
  import { getModalState } from '$lib/session'
  import type { BarPlotItem } from '$lib/plots/bar/types'
  import type { SvelteComponent } from 'svelte'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import {
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
    ModalContentDownloadBarPlot,
    ModalContentStimulusModification,
    ModalContentExportAggregatedData,
  } from '$lib/modals'
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
    modalState.open(
      ModalContentAoiModification as unknown as typeof SvelteComponent,
      'AOI customization',
      {
        selectedStimulus: settings.stimulusId.toString(),
        source,
      }
    )
  }

  const openStimulusModificationModal = () => {
    modalState.open(
      ModalContentStimulusModification as unknown as typeof SvelteComponent,
      'Stimulus customization',
      {
        source,
      }
    )
  }

  const openUserGroupsModal = () => {
    modalState.open(
      ModalContentParticipantsGroups as unknown as typeof SvelteComponent,
      'Participants groups',
      {
        source,
      }
    )
  }

  const downloadPlot = () => {
    modalState.open(
      ModalContentDownloadBarPlot as unknown as typeof SvelteComponent,
      'Download bar plot',
      {
        item,
      }
    )
  }

  const exportAggregatedData = () => {
    modalState.open(
      ModalContentExportAggregatedData as unknown as typeof SvelteComponent,
      'Export aggregated data',
      {
        item,
      }
    )
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
