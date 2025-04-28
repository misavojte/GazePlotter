<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import type { TransitionMatrixGridType } from '$lib/type/gridType'
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

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange: (newSettings: Partial<TransitionMatrixGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  const openMaxValueModal = () => {
    modalStore.open(ModalContentMaxValue as any, 'Set color range values', {
      settings,
      settingsChange,
    })
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        forceRedraw,
      }
    )
  }

  const openColorScaleModal = () => {
    modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
      settings,
      settingsChange,
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
