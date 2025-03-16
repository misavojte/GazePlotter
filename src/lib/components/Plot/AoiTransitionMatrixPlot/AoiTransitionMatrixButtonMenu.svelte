<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import type { AoiTransitionMatrixGridType } from '$lib/type/gridType'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Download from 'lucide-svelte/icons/download'
  import BarChart from 'lucide-svelte/icons/bar-chart'
  import type { ComponentProps } from 'svelte'
  import ModalContentMaxValue from '$lib/components/Modal/ModalContent/ModalContentMaxValue.svelte'
  import type { SvelteComponent } from 'svelte'

  interface Props {
    settings: AoiTransitionMatrixGridType
    settingsChange: (newSettings: Partial<AoiTransitionMatrixGridType>) => void
    calculatedMaxValue: number
    onMaxValueChange: (newMaxValue: number) => void
  }

  let {
    settings,
    settingsChange = () => {},
    calculatedMaxValue,
    onMaxValueChange = () => {},
  }: Props = $props()

  const openMaxValueModal = () => {
    try {
      modalStore.open(
        ModalContentMaxValue as any,
        'Set maximum color scale value',
        {
          currentMaxValue: settings.maxColorValue || calculatedMaxValue,
          calculatedValue: calculatedMaxValue,
          isAuto: settings.maxColorValue === 0,
          onConfirm: onMaxValueChange,
        }
      )
    } catch (error) {
      console.error('Error opening modal:', error)
    }
  }

  let items = $derived([
    {
      label: 'Set max color scale value',
      action: openMaxValueModal,
      icon: BarChart,
    },
  ] as any)
</script>

<MenuButton {items} />
