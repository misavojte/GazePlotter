<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { getModalState } from '$lib/session'
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
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
    settings: BarPlotGridType
  }

  let { settings }: Props = $props()
  const modalState = getModalState()

  const source = createCommandSourcePlotPattern(
    untrack(() => settings),
    'modal'
  )

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
        settings,
      }
    )
  }

  const exportAggregatedData = () => {
    modalState.open(
      ModalContentExportAggregatedData as unknown as typeof SvelteComponent,
      'Export aggregated data',
      {
        settings,
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
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
