<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import type { BarPlotGridType } from '$lib/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import Copy from 'lucide-svelte/icons/copy'
  import Trash from 'lucide-svelte/icons/trash'
  import BarChartIcon from 'lucide-svelte/icons/bar-chart'
  import {
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
    ModalContentDownloadBarPlot,
    ModalContentBarChartAxes,
    ModalContentStimulusModification,
  } from '$lib/modals'
  import { getContext } from 'svelte'
  import type { ComponentProps } from 'svelte'

  interface Props {
    settings: BarPlotGridType
    settingsChange: (newSettings: Partial<BarPlotGridType>) => void
    forceRedraw: () => void
  }

  let { settings, settingsChange, forceRedraw }: Props = $props()

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
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
