<script lang="ts">
  import { GeneralButtonMenu as MenuButton } from '$lib/shared/components'
  import { getModalState } from '$lib/session'
  import Download from 'lucide-svelte/icons/download'
  import Settings from 'lucide-svelte/icons/settings-2'
  import Users from 'lucide-svelte/icons/users'
  import View from 'lucide-svelte/icons/view'
  import type { ComponentProps } from 'svelte'
  import type { ScarfPlotItem } from '$lib/plots/scarf/types'
  import type { SvelteComponent } from 'svelte'
  import {
    ModalContentParticipantModification,
    ModalContentStimulusModification,
    ModalContentAoiModification,
    ModalContentAoiVisibility,
    ModalContentDownloadScarfPlot,
    ModalContentParticipantsGroups,
    ModalContentExportSegmentedData,
  } from '$lib/modals'
  import { createCommandSourcePlotPattern } from '$lib/workspace/commands'
  import { untrack } from 'svelte'

  interface Props {
    item: ScarfPlotItem
  }

  let { item }: Props = $props()
  const modalState = getModalState()
  const settings = $derived(item.settings)

  const source = createCommandSourcePlotPattern(untrack(() => item), 'modal')

  const openModal = (
    component: any,
    title: string,
    extraProps: Record<string, any> = {}
  ) => {
    modalState.open(component as unknown as typeof SvelteComponent, title, {
      source,
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
    { isDivider: true },
    {
      label: 'AOI visibility',
      action: () => openModal(ModalContentAoiVisibility, 'AOI visibility'),
      icon: View,
    },
    { isDivider: true },
    {
      label: 'Export segmented data',
      action: () =>
        openModal(ModalContentExportSegmentedData, 'Export segmented data', {
          item,
        }),
      icon: Download,
    },
    {
      label: 'Download plot',
      action: () =>
        openModal(ModalContentDownloadScarfPlot, 'Download scarf plot', {
          item,
        }),
      icon: Download,
    },
  ]
</script>

<MenuButton {items} />
