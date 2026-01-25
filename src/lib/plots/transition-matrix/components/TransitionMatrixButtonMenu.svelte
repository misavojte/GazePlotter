<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { untrack } from 'svelte'
  import { modalState } from '$lib/modals'
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
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const source = createCommandSourcePlotPattern(
    untrack(() => settings),
    'modal'
  )

  const openMaxValueModal = () => {
    modalState.open(ModalContentMaxValue as any, 'Set color range values', {
      settings,
      source,
      onWorkspaceCommand,
    })
  }

  const openStimulusModificationModal = () => {
    modalState.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openAoiModificationModal = () => {
    modalState.open(ModalContentAoiModification as any, 'AOI customization', {
      selectedStimulus: settings.stimulusId.toString(),
      source,
      onWorkspaceCommand,
    })
  }

  const openUserGroupsModal = () => {
    modalState.open(
      ModalContentParticipantsGroups as any,
      'Participants groups',
      {
        settings,
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openColorScaleModal = () => {
    modalState.open(ModalContentColorScale as any, 'Customize color scale', {
      settings,
      source,
      onWorkspaceCommand,
    })
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
