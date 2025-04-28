<script lang="ts">
  import MajorControlButton from '$lib/components/General/GeneralButton/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import { ModalContentDownloadScanGraph } from '$lib/modals'
  import { processingFileStateStore } from '$lib/stores/processingFileStateStore'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = () => {
    modalStore.open(ModalContentDownloadScanGraph as any, 'Export to ScanGraph')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export to ScanGraph
</MajorControlButton>
