<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import ModalContentDownloadScanGraph from '$lib/components/Modal/ModalContent/ModalContentDownloadScanGraph.svelte'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = () => {
    modalStore.open(ModalContentDownloadScanGraph, 'Export to ScanGraph')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export to ScanGraph
</MajorControlButton>
