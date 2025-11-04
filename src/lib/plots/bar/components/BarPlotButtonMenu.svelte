<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import BarChartIcon from 'lucide-svelte/icons/bar-chart'
  import {
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
    ModalContentDownloadBarPlot,
    ModalContentBarChartAxes,
    ModalContentStimulusModification,
    ModalContentExportAggregatedData,
  } from '$lib/modals'
  import type { ComponentProps } from 'svelte'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'
  import { createCommandSourcePlotPattern } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    settings: BarPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const source = createCommandSourcePlotPattern(settings, 'modal')

  const openAoiModificationModal = () => {
    modalStore.open(
      ModalContentAoiModification as unknown as typeof SvelteComponent,
      'AOI customization',
      {
        selectedStimulus: settings.stimulusId.toString(),
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openStimulusModificationModal = () => {
    modalStore.open(
      ModalContentStimulusModification as unknown as typeof SvelteComponent,
      'Stimulus customization',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openUserGroupsModal = () => {
    modalStore.open(
      ModalContentParticipantsGroups as unknown as typeof SvelteComponent,
      'Participants groups',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openBarChartAxesModal = () => {
    modalStore.open(
      ModalContentBarChartAxes as unknown as typeof SvelteComponent,
      'Bar Chart Axes',
      {
        settings,
        onWorkspaceCommand,
        source,
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

  const exportAggregatedData = () => {
    modalStore.open(
      ModalContentExportAggregatedData as unknown as typeof SvelteComponent,
      'Export aggregated data',
      {
        settings,
      }
    )
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
      label: 'Setup participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    {
      label: 'Bar Chart Axes',
      action: openBarChartAxesModal,
      icon: BarChartIcon,
    },
    {
      label: 'Export aggregated data',
      action: exportAggregatedData,
      icon: Download,
    },
    {
      label: 'Download plot',
      action: downloadPlot,
      icon: Download,
    },
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
