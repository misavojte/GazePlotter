<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import type { TransitionMatrixGridType } from '$lib/workspace/type/gridType'
  import BarChart from 'lucide-svelte/icons/bar-chart'
  import Download from 'lucide-svelte/icons/download'
  import Palette from 'lucide-svelte/icons/palette'
  import Settings from 'lucide-svelte/icons/settings-2'
  import {
    ModalContentMaxValue,
    ModalContentColorScale,
    ModalContentDownloadTransitionMatrix,
    ModalContentStimulusModification,
  } from '$lib/modals'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: TransitionMatrixGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const openMaxValueModal = () => {
    modalStore.open(ModalContentMaxValue as any, 'Set color range values', {
      settings,
      onWorkspaceCommand,
    })
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        onWorkspaceCommand,
      }
    )
  }

  const openColorScaleModal = () => {
    modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
      settings,
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
      label: 'Set color range values',
      action: openMaxValueModal,
      icon: BarChart,
    },
    {
      label: 'Stimulus customization',
      action: openStimulusModificationModal,
      icon: Settings,
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
