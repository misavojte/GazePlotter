<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import Copy from 'lucide-svelte/icons/copy'
  import Trash from 'lucide-svelte/icons/trash'
  import BarChartIcon from 'lucide-svelte/icons/bar-chart'
  import ModalContentAoiModification from '$lib/components/Modal/ModalContent/ModalContentAoiModification.svelte'
  import ModalContentParticipantsGroups from '$lib/components/Modal/ModalContent/ModalContentParticipantsGroups.svelte'
  import ModalContentDownloadBarPlot from '$lib/components/Modal/ModalContent/ModalContentDownloadBarPlot.svelte'
  import ModalContentBarChartAxes from '$lib/components/Modal/ModalContent/ModalContentBarChartAxes.svelte'
  import ModalContentStimulusModification from '$lib/components/Modal/ModalContent/ModalContentStimulusModification.svelte'
  import { getContext } from 'svelte'
  import type { GridStoreType } from '$lib/stores/gridStore'
  import type { ComponentProps } from 'svelte'

  interface Props {
    settings: BarPlotGridType
    settingsChange: (newSettings: Partial<BarPlotGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

  const store = getContext<GridStoreType>('gridStore')

  const openAoiModificationModal = () => {
    modalStore.open(
      ModalContentAoiModification as unknown as typeof SvelteComponent,
      'AOI customization',
      {
        selectedStimulus: settings.stimulusId.toString(),
        forceRedraw,
      }
    )
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as unknown as typeof SvelteComponent,
      'Stimulus customization',
      {
        forceRedraw,
      }
    )
  }

  const openUserGroupsModal = () => {
    modalStore.open(
      ModalContentParticipantsGroups as unknown as typeof SvelteComponent,
      'Participants groups',
      {
        forceRedraw,
      }
    )
  }

  const openBarChartAxesModal = () => {
    modalStore.open(
      ModalContentBarChartAxes as unknown as typeof SvelteComponent,
      'Bar Chart Axes',
      {
        settings,
        settingsChange,
      }
    )
  }

  const downloadPlot = () => {
    modalStore.open(
      ModalContentDownloadBarPlot as unknown as typeof SvelteComponent,
      'Download bar plot',
      {
        settings,
      }
    )
  }

  const deletePlot = () => {
    store.removeItem(settings.id)
  }

  const duplicatePlot = () => {
    store.duplicateItem(settings)
  }

  let items = $derived([
    {
      label: 'Bar Chart Axes',
      action: openBarChartAxesModal,
      icon: BarChartIcon,
    },
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
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    {
      label: 'Download plot',
      action: downloadPlot,
      icon: Download,
    },
    {
      label: 'Duplicate bar plot',
      action: duplicatePlot,
      icon: Copy,
    },
    {
      label: 'Delete bar plot',
      action: deletePlot,
      icon: Trash,
    },
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
