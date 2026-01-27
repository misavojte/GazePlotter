<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalState } from '$lib/modals'
  import type { AoiStreamPlotGridType } from '$lib/workspace/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'

  import {
    ModalContentAoiModification,
    ModalContentDownloadAoiStreamPlot,
    ModalContentParticipantsGroups,
    ModalContentStimulusModification,
  } from '$lib/modals'
  import type { ComponentProps } from 'svelte'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    settings: AoiStreamPlotGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const source = createCommandSourcePlotPattern(settings, 'modal')

  const openAoiModificationModal = () => {
    modalState.open(
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
    modalState.open(
      ModalContentStimulusModification as unknown as typeof SvelteComponent,
      'Stimulus customization',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openUserGroupsModal = () => {
    modalState.open(
      ModalContentParticipantsGroups as unknown as typeof SvelteComponent,
      'Participants groups',
      {
        source,
        onWorkspaceCommand,
      }
    )
  }

  const openDownloadModal = () => {
    modalState.open(
      ModalContentDownloadAoiStreamPlot as unknown as typeof SvelteComponent,
      'Download Time-binned AOI Occupancy',
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
      label: 'Download plot',
      action: openDownloadModal,
      icon: Download,
    },
  ] as ComponentProps<typeof MenuButton>['items'])
</script>

<MenuButton {items} />
