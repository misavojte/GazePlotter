<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { untrack } from 'svelte'
  import { getModalState } from '$lib/session'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import Users from 'lucide-svelte/icons/users'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import {
    ModalContentDownloadTransitionMatrix,
    ModalContentStimulusModification,
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
  } from '$lib/modals'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    settings: TransitionMatrixGridType
  }

  let { settings }: Props = $props()
  const modalState = getModalState()

  const source = createCommandSourcePlotPattern(
    untrack(() => settings),
    'modal'
  )

  const openStimulusModificationModal = () => {
    modalState.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        source,
      }
    )
  }

  const openAoiModificationModal = () => {
    modalState.open(ModalContentAoiModification as any, 'AOI customization', {
      selectedStimulus: settings.stimulusId.toString(),
      source,
    })
  }

  const openUserGroupsModal = () => {
    modalState.open(
      ModalContentParticipantsGroups as any,
      'Participants groups',
      {
        settings,
        source,
      }
    )
  }

  const openDownloadModal = () => {
    try {
      modalState.open(
        ModalContentDownloadTransitionMatrix as any,
        'Download Transition Matrix',
        {
          settings,
        }
      )
    } catch (error) {
      console.error('Error opening download modal:', error)
    }
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
      label: 'Participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    { isDivider: true },
    {
      label: 'Download plot',
      action: openDownloadModal,
      icon: Download,
    },
  ] as any)
</script>

<MenuButton {items} />
