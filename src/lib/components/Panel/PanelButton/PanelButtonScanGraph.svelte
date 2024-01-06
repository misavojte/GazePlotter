<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/stores/modalStore.js'
  import ModalContentDownloadScanGraph from '$lib/components/Modal/ModalContent/ModalContentDownloadScanGraph.svelte'

  const handleClick = () => {
    modalStore.open(ModalContentDownloadScanGraph, 'Export to ScanGraph')
  }
</script>

<MajorControlButton on:click={handleClick}>
  Export to ScanGraph
</MajorControlButton>
