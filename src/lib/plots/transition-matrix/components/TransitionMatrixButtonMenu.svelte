<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import BarChart from 'lucide-svelte/icons/bar-chart'
  import Users from 'lucide-svelte/icons/users'
  import Download from 'lucide-svelte/icons/download'
  import Palette from 'lucide-svelte/icons/palette'
  import Settings from 'lucide-svelte/icons/settings-2'
  import {
    ModalContentMaxValue,
    ModalContentColorScale,
    ModalContentDownloadTransitionMatrix,
    ModalContentStimulusModification,
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
  } from '$lib/modals'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { createCommandSourcePlotPattern } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const source = createCommandSourcePlotPattern(settings, 'modal')

  const openMaxValueModal = () => {
    modalStore.open(ModalContentMaxValue as any, 'Set color range values', {
      settings,
      source,
      onWorkspaceCommand,
    })
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openAoiModificationModal = () => {
    modalStore.open(ModalContentAoiModification as any, 'AOI customization', {
      settings,
      source,
      onWorkspaceCommand,
    })
  }

  const openUserGroupsModal = () => {
    modalStore.open(ModalContentParticipantsGroups as any, 'Participants groups', {
      settings,
      source,
      onWorkspaceCommand,
    })
  }

  const openColorScaleModal = () => {
    modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
      settings,
      source,
      onWorkspaceCommand,
    })
  }

  const openDownloadModal = () => {
    try {
      modalStore.open(
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
    {
      label: 'Set color range values',
      action: openMaxValueModal,
      icon: BarChart,
    },
    {
      label: 'Customize color scale',
      action: openColorScaleModal,
      icon: Palette,
    },
    {
      label: 'Download plot',
      action: openDownloadModal,
      icon: Download,
    },
  ] as any)
</script>

<MenuButton {items} />
