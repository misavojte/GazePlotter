<script lang="ts">
  import MenuButton from '$lib/components/General/GeneralButton/GeneralButtonMenu.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import ModalContentScarfPlotClip from '$lib/components/Modal/ModalContent/ModalContentScarfPlotClip.svelte'
  import {
    duplicateScarfPlotState,
    getScarfPlotState,
    removeScarfPlotState,
    scarfPlotStates,
  } from '$lib/stores/scarfPlotsStore.js'
  import ModalContentDownloadScarfPlot from '../../../Modal/ModalContent/ModalContentDownloadScarfPlot.svelte'
  import ModalContentAoiModification from '../../../Modal/ModalContent/ModalContentAoiModification.svelte'
  import ModalContentAoiVisibility from '../../../Modal/ModalContent/ModalContentAoiVisibility.svelte'

  export let scarfId: number
  let currentStimulusId: number
  const unsubscribe = scarfPlotStates.subscribe(states => {
    const state = getScarfPlotState(states, scarfId)
    if (!state) {
      unsubscribe()
      return
    }
    currentStimulusId = state.stimulusId
  })

  const openClipModal = () => {
    modalStore.open(ModalContentScarfPlotClip, 'Clip scarf timeline', {
      scarfId,
    })
  }

  const openAoiModificationModal = () => {
    modalStore.open(ModalContentAoiModification, 'AOI customization', {
      selectedStimulus: currentStimulusId.toString(),
    })
  }

  const openAoiVisibilityModal = () => {
    modalStore.open(ModalContentAoiVisibility, 'AOI visibility')
  }

  const downloadPlot = () => {
    modalStore.open(ModalContentDownloadScarfPlot, 'Download scarf plot', {
      scarfId,
    })
  }

  const deleteScarf = () => {
    unsubscribe()
    removeScarfPlotState(scarfId)
  }

  const duplicateScarf = () => {
    duplicateScarfPlotState(scarfId)
  }

  const items: { label: string; action: () => void }[] = [
    { label: 'AOI customization', action: openAoiModificationModal },
    { label: 'AOI visibility', action: openAoiVisibilityModal },
    { label: 'Clip timeline', action: openClipModal },
    { label: 'Download plot', action: downloadPlot },
    { label: 'Duplicate scarf', action: duplicateScarf },
    { label: 'Delete scarf', action: deleteScarf },
  ]
</script>

<MenuButton {items} />
