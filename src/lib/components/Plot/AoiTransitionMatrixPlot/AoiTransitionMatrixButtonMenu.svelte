<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'
  import BarChart from 'lucide-svelte/icons/bar-chart'
  import Download from 'lucide-svelte/icons/download'
  import Palette from 'lucide-svelte/icons/palette'
  import ModalContentMaxValue from '$lib/components/Modal/ModalContent/ModalContentMaxValue.svelte'
  import ModalContentColorScale from '$lib/components/Modal/ModalContent/ModalContentColorScale.svelte'
  import ModalContentDownloadAoiTransitionMatrix from '$lib/components/Modal/ModalContent/ModalContentDownloadAoiTransitionMatrix.svelte'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange: (newSettings: Partial<AoiTransitionMatrixGridType>) => void
  }

  let { settings, settingsChange = () => {} }: Props = $props()

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
        ModalContentDownloadAoiTransitionMatrix as any,
        'Download AOI Transition Matrix',
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
