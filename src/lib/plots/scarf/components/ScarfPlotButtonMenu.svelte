<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import Download from 'lucide-svelte/icons/download'
  import Scissors from 'lucide-svelte/icons/scissors-line-dashed'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import {
    ModalContentParticipantModification,
    ModalContentStimulusModification,
    ModalContentScarfPlotClip,
    ModalContentAoiModification,
    ModalContentAoiVisibility,
    ModalContentDownloadScarfPlot,
    ModalContentParticipantsGroups,
    ModalContentExportSegmentedData,
  } from '$lib/modals'

  interface Props {
    settings: ScarfGridType
    multipleSettings?: ScarfGridType[]
    settingsChange: (newSettings: Partial<ScarfGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  const openClipModal = () => {
    modalStore.open(
      ModalContentScarfPlotClip as unknown as typeof SvelteComponent,
      'Clip scarf timeline',
      {
        settings,
        settingsChange,
      }
    )
  }

  const openAoiModificationModal = () => {
    modalStore.open(
      ModalContentAoiModification as unknown as typeof SvelteComponent,
      'AOI customization',
      {
        selectedStimulus: settings.stimulusId.toString(),
        forceRedraw,
      }
    )
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as unknown as typeof SvelteComponent,
      'Stimulus customization',
      {
        forceRedraw,
      }
    )
  }

  const openAoiVisibilityModal = () => {
    modalStore.open(
      ModalContentAoiVisibility as unknown as typeof SvelteComponent,
      'AOI visibility',
      {
        forceRedraw,
      }
    )
  }

  const openUserGroupsModal = () => {
    modalStore.open(
      ModalContentParticipantsGroups as unknown as typeof SvelteComponent,
      'Participants groups',
      {
        forceRedraw,
      }
    )
  }

  const openParticipantModificationModal = () => {
    modalStore.open(
      ModalContentParticipantModification as unknown as typeof SvelteComponent,
      'Participant customization',
      {
        forceRedraw,
      }
    )
  }

  const downloadPlot = () => {
    modalStore.open(
      ModalContentDownloadScarfPlot as unknown as typeof SvelteComponent,
      'Download scarf plot',
      {
        settings,
      }
    )
  }

  const openExportSegmentedDataModal = () => {
    modalStore.open(
      ModalContentExportSegmentedData as unknown as typeof SvelteComponent,
      'Export segmented data',
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
      label: 'AOI visibility',
      action: openAoiVisibilityModal,
      icon: View,
    },
    {
      label: 'Participant customization',
      action: openParticipantModificationModal,
      icon: Users,
    },
    {
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    {
      label: 'Clip timeline',
      action: openClipModal,
      icon: Scissors,
    },
    {
      label: 'Export segmented data',
      action: openExportSegmentedDataModal,
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
