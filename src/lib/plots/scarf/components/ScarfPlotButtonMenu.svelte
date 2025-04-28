<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import Copy from 'lucide-svelte/icons/copy'
  import Download from 'lucide-svelte/icons/download'
  import Scissors from 'lucide-svelte/icons/scissors-line-dashed'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Trash from 'lucide-svelte/icons/trash'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import {
    ModalContentParticipantModification,
    ModalContentStimulusModification,
    ModalContentScarfPlotClip,
    ModalContentAoiModification,
    ModalContentAoiVisibility,
    ModalContentDownloadScarfPlot,
    ModalContentParticipantsGroups,
  } from '$lib/modals'

  interface Props {
    settings: ScarfGridType
    multipleSettings?: ScarfGridType[]
    settingsChange: (newSettings: Partial<ScarfGridType>) => void
    forceRedraw: () => void
  }

  let {
    settings,
    multipleSettings = [],
    settingsChange,
    forceRedraw,
  }: Props = $props()

  let isMultiSelection = $derived(multipleSettings.length > 0)

  let effectiveSettings = $derived(
    isMultiSelection ? multipleSettings : [settings]
  )

  const store = getContext<GridStoreType>('gridStore')

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

  const deleteScarf = () => {
    if (isMultiSelection) {
      for (const setting of effectiveSettings) {
        store.removeItem(setting.id)
      }
    } else {
      store.removeItem(settings.id)
    }
  }

  const duplicateScarf = () => {
    if (isMultiSelection) {
      store.batchDuplicateItems(effectiveSettings)
    } else {
      store.duplicateItem(settings)
    }
  }

  let items = $derived([
    {
      label: 'AOI customization',
      action: openAoiModificationModal,
      icon: Settings,
      disabled: isMultiSelection,
    },
    {
      label: 'Stimulus customization',
      action: openStimulusModificationModal,
      icon: Settings,
      disabled: isMultiSelection,
    },
    {
      label: 'AOI visibility',
      action: openAoiVisibilityModal,
      icon: View,
      disabled: isMultiSelection,
    },
    {
      label: 'Participant customization',
      action: openParticipantModificationModal,
      icon: Users,
      disabled: isMultiSelection,
    },
    {
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
      disabled: isMultiSelection,
    },
    {
      label: 'Clip timeline',
      action: openClipModal,
      icon: Scissors,
      disabled: isMultiSelection,
    },
    {
      label: 'Download plot',
      action: downloadPlot,
      icon: Download,
      disabled: isMultiSelection,
    },
    {
      label: isMultiSelection
        ? `Duplicate ${effectiveSettings.length} scarfs`
        : 'Duplicate scarf',
      action: duplicateScarf,
      icon: Copy,
    },
    {
      label: isMultiSelection
        ? `Delete ${effectiveSettings.length} scarfs`
        : 'Delete scarf',
      action: deleteScarf,
      icon: Trash,
    },
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
