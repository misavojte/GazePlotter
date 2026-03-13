<script lang="ts">
  import { PlotMenuButton } from '$lib/plots/shared'
  import { untrack } from 'svelte'
  import { getGazePlotterSession } from '$lib/session'
  import type { TransitionMatrixPlotItem } from '$lib/plots/transition-matrix/types'
  import Users from 'lucide-svelte/icons/users'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import {
    ModalContentDownloadTransitionMatrix,
    ModalContentStimulusModification,
    ModalContentAoiModification,
    ModalContentParticipantsGroups,
  } from '$lib/modals'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'

  interface Props {
    item: TransitionMatrixPlotItem
  }

  let { item }: Props = $props()
  const { errorService, modalState } = getGazePlotterSession()
  const settings = $derived(item.settings)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  const openStimulusModificationModal = () => {
    modalState.open(
      ModalContentStimulusModification as any,
      'Stimulus customization',
      {
        source,
      }
    )
  }

  const openAoiModificationModal = () => {
    modalState.open(ModalContentAoiModification as any, 'AOI customization', {
      selectedStimulus: settings.stimulusId.toString(),
      source,
    })
  }

  const openUserGroupsModal = () => {
    modalState.open(
      ModalContentParticipantsGroups as any,
      'Participants groups',
      {
        settings,
        source,
      }
    )
  }

  const openDownloadModal = () => {
    try {
      modalState.open(
        ModalContentDownloadTransitionMatrix as any,
        'Download Transition Matrix',
        {
          item,
        }
      )
    } catch (error) {
      errorService.report({
        origin: 'plot',
        severity: 'recoverable',
        userMessage: 'Could not open the Transition Matrix download dialog.',
        cause: error,
        context: {
          itemId: item.id,
          plotType: item.type,
        },
      })
    }
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
      label: 'Participants groups',
      action: openUserGroupsModal,
      icon: Users,
    },
    { isDivider: true },
    {
      label: 'Download plot',
      action: openDownloadModal,
      icon: Download,
    },
  ] as any)
</script>

<PlotMenuButton {items} />
