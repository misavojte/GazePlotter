<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import type { TransitionMatrixGridType } from '$lib/type/gridType'
  import BarChart from 'lucide-svelte/icons/bar-chart'
  import Download from 'lucide-svelte/icons/download'
  import Palette from 'lucide-svelte/icons/palette'
  import ModalContentMaxValue from '$lib/components/Modal/ModalContent/ModalContentMaxValue.svelte'
  import ModalContentColorScale from '$lib/components/Modal/ModalContent/ModalContentColorScale.svelte'
  import ModalContentDownloadTransitionMatrix from '$lib/components/Modal/ModalContent/ModalContentDownloadTransitionMatrix.svelte'

  interface Props {
    settings: TransitionMatrixGridType
    settingsChange: (newSettings: Partial<TransitionMatrixGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  const openMaxValueModal = () => {
    try {
      modalStore.open(
        ModalContentMaxValue as any,
        'Set maximum color scale value',
        {
          settings,
          settingsChange,
        }
      )
    } catch (error) {
      console.error('Error opening modal:', error)
    }
  }

  const openColorScaleModal = () => {
    try {
      modalStore.open(ModalContentColorScale as any, 'Customize color scale', {
        settings,
        settingsChange,
      })
    } catch (error) {
      console.error('Error opening color scale modal:', error)
    }
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
