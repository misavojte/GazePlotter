<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import ModalContentScarfPlotClip from '$lib/components/Modal/ModalContent/ModalContentScarfPlotClip.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import type { GridStoreType } from '$lib/stores/gridStore.ts'
  import Copy from 'lucide-svelte/icons/copy'
  import Download from 'lucide-svelte/icons/download'
  import Scissors from 'lucide-svelte/icons/scissors-line-dashed'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Trash from 'lucide-svelte/icons/trash'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import ModalContentAoiModification from '../../../Modal/ModalContent/ModalContentAoiModification.svelte'
  import ModalContentAoiVisibility from '../../../Modal/ModalContent/ModalContentAoiVisibility.svelte'
  import ModalContentDownloadScarfPlot from '../../../Modal/ModalContent/ModalContentDownloadScarfPlot.svelte'
  import ModalContentParticipantsGroups from '$lib/components/Modal/ModalContent/ModalContentParticipantsGroups.svelte'
  import { getContext } from 'svelte'
  import type { ScarfGridType } from '$lib/type/gridType.ts'

  export let settings: ScarfGridType
  const store = getContext<GridStoreType>('gridStore')

  const openClipModal = () => {
    modalStore.open(ModalContentScarfPlotClip, 'Clip scarf timeline', {
      settings,
      store,
    })
  }

  const openAoiModificationModal = () => {
    modalStore.open(ModalContentAoiModification, 'AOI customization', {
      selectedStimulus: settings.stimulusId.toString(),
      gridStore: store,
    })
  }

  const openAoiVisibilityModal = () => {
    modalStore.open(ModalContentAoiVisibility, 'AOI visibility', {
      gridStore: store,
    })
  }

  const openUserGroupsModal = () => {
    modalStore.open(ModalContentParticipantsGroups, 'Participants groups')
  }

  const downloadPlot = () => {
    modalStore.open(ModalContentDownloadScarfPlot, 'Download scarf plot', {
      settings,
    })
  }

  const deleteScarf = () => {
    store.removeItem(settings.id)
  }

  const duplicateScarf = () => {
    store.duplicateItem(settings)
  }

  const items: ComponentProps<MenuButton>['items'] = [
    {
      label: 'AOI customization',
      action: openAoiModificationModal,
      icon: Settings,
    },
    { label: 'AOI visibility', action: openAoiVisibilityModal, icon: View },
    {
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    { label: 'Clip timeline', action: openClipModal, icon: Scissors },
    { label: 'Download plot', action: downloadPlot, icon: Download },
    { label: 'Duplicate scarf', action: duplicateScarf, icon: Copy },
    { label: 'Delete scarf', action: deleteScarf, icon: Trash },
  ]
</script>

<MenuButton {items} />
