<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Trash from 'lucide-svelte/icons/trash'
  import Users from 'lucide-svelte/icons/users'
  import Copy from 'lucide-svelte/icons/copy'
  import type { ComponentProps } from 'svelte'
  import ModalContentParticipantsGroups from '$lib/components/Modal/ModalContent/ModalContentParticipantsGroups.svelte'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType'

  export let settings: ScarfGridType
  export let multipleSettings: ScarfGridType[] = []

  $: isMultiSelection = multipleSettings.length > 0
  $: effectiveSettings = isMultiSelection ? multipleSettings : [settings]

  const store = getContext<GridStoreType>('gridStore')

  const openUserGroupsModal = () => {
    modalStore.open(ModalContentParticipantsGroups, 'Participants groups')
  }

  // TODO: Implement download modal
  const downloadPlot = () => {
    // modalStore.open(ModalContentDownloadAOITransitionMatrix, 'Download AOI transition matrix', {
    //   settings,
    // })
    console.log('Download AOI Transition Matrix')
  }

  const deletePlot = () => {
    if (isMultiSelection) {
      for (const setting of effectiveSettings) {
        store.removeItem(setting.id)
      }
    } else {
      store.removeItem(settings.id)
    }
  }

  const duplicatePlot = () => {
    if (isMultiSelection) {
      store.batchDuplicateItems(effectiveSettings)
    } else {
      store.duplicateItem(settings)
    }
  }

  $: items = [
    {
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
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
        ? `Duplicate ${effectiveSettings.length} plots`
        : 'Duplicate plot',
      action: duplicatePlot,
      icon: Copy,
    },
    {
      label: isMultiSelection
        ? `Delete ${effectiveSettings.length} plots`
        : 'Delete plot',
      action: deletePlot,
      icon: Trash,
    },
  ] as ComponentProps<MenuButton>['items']
</script>

<MenuButton {items} />
