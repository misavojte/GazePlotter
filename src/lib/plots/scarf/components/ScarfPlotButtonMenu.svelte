<script lang="ts">
  import { PlotMenuButton } from '$lib/plots/shared'
  import { getModalState } from '$lib/session'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import {
    participantModificationModal,
    stimulusModificationModal,
    aoiModificationModal,
    aoiVisibilityModal,
    downloadScarfPlotModal,
    participantsGroupsModal,
    exportSegmentedDataModal,
  } from '$lib/modals/definitions'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const modalState = getModalState()
  const settings = $derived(item.settings)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  const items: ComponentProps<typeof PlotMenuButton>['items'] = [
    {
      label: 'AOI customization',
      action: () =>
        modalState.open(aoiModificationModal, {
          selectedStimulus: settings.stimulusId.toString(),
          source,
        }),
      icon: Settings,
    },
    {
      label: 'Stimulus customization',
      action: () => modalState.open(stimulusModificationModal, { source }),
      icon: Settings,
    },
    {
      label: 'Participant customization',
      action: () => modalState.open(participantModificationModal, { source }),
      icon: Users,
    },
    {
      label: 'Setup participants groups',
      action: () => modalState.open(participantsGroupsModal, { source }),
      icon: Users,
    },
    { isDivider: true },
    {
      label: 'AOI visibility',
      action: () => modalState.open(aoiVisibilityModal, { source }),
      icon: View,
    },
    { isDivider: true },
    {
      label: 'Export segmented data',
      action: () => modalState.open(exportSegmentedDataModal, {}),
      icon: Download,
    },
    {
      label: 'Download plot',
      action: () => modalState.open(downloadScarfPlotModal, { item }),
      icon: Download,
    },
  ]
</script>

<PlotMenuButton {items} />
