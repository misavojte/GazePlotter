<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import Download from 'lucide-svelte/icons/download'
  import Scissors from 'lucide-svelte/icons/scissors-line-dashed'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import type { ScarfGridType } from '$lib/workspace/type/gridType'
  import type { SvelteComponent } from 'svelte'
  import {
    ModalContentParticipantModification,
    ModalContentStimulusModification,
    ModalContentScarfPlotClip,
    ModalContentAoiModification,
    ModalContentAoiVisibility,
    ModalContentDownloadScarfPlot,
    ModalContentParticipantsGroups,
    ModalContentExportSegmentedData,
  } from '$lib/modals'
  import type { WorkspaceCommand } from '$lib/workspace/commands'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    settings: ScarfGridType
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let { settings, onWorkspaceCommand }: Props = $props()

  const source = createCommandSourcePlotPattern(
    untrack(() => settings),
    'modal'
  )

  const openModal = (
    component: any,
    title: string,
    extraProps: Record<string, any> = {}
  ) => {
    modalStore.open(component as unknown as typeof SvelteComponent, title, {
      source,
      onWorkspaceCommand,
      ...extraProps,
    })
  }

  const items: ComponentProps<typeof MenuButton>['items'] = [
    {
      label: 'AOI customization',
      action: () =>
        openModal(ModalContentAoiModification, 'AOI customization', {
          selectedStimulus: settings.stimulusId.toString(),
        }),
      icon: Settings,
    },
    {
      label: 'Stimulus customization',
      action: () =>
        openModal(ModalContentStimulusModification, 'Stimulus customization'),
      icon: Settings,
    },
    {
      label: 'Participant customization',
      action: () =>
        openModal(
          ModalContentParticipantModification,
          'Participant customization'
        ),
      icon: Users,
    },
    {
      label: 'Setup participants groups',
      action: () =>
        openModal(ModalContentParticipantsGroups, 'Participants groups'),
      icon: Users,
    },
    {
      label: 'AOI visibility',
      action: () => openModal(ModalContentAoiVisibility, 'AOI visibility'),
      icon: View,
    },
    {
      label: 'Clip timeline',
      action: () =>
        openModal(ModalContentScarfPlotClip, 'Clip scarf timeline', {
          settings,
        }),
      icon: Scissors,
    },
    {
      label: 'Export segmented data',
      action: () =>
        openModal(ModalContentExportSegmentedData, 'Export segmented data', {
          settings,
        }),
      icon: Download,
    },
    {
      label: 'Download plot',
      action: () =>
        openModal(ModalContentDownloadScarfPlot, 'Download scarf plot', {
          settings,
        }),
      icon: Download,
    },
  ]
</script>

<MenuButton {items} />
