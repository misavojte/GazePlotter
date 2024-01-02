<script lang="ts">
    import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
    import { modalStore } from '$lib/stores/modalStore.js'
    import ModalContentDownloadScanGraph from '../../Modal/ModalContent/ModalContentDownloadScanGraph.svelte'

    const handleClick = () => {
      modalStore.open(ModalContentDownloadScanGraph, 'Export to ScanGraph')
    }
</script>

<MajorControlButton on:click={handleClick}>
    Export to ScanGraph
</MajorControlButton>
