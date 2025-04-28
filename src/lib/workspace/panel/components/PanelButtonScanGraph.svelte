<script lang="ts">
  import MajorControlButton from '$lib/shared/components/GeneralButtonMajor.svelte'
  import { modalStore } from '$lib/modals/shared/stores/modalStore.js'
  import { ModalContentDownloadScanGraph } from '$lib/modals'
  import { processingFileStateStore } from '$lib/workspace'

  let isDisabled = $derived($processingFileStateStore === 'processing')

  const handleClick = () => {
    modalStore.open(ModalContentDownloadScanGraph as any, 'Export to ScanGraph')
  }
</script>

<MajorControlButton {isDisabled} onclick={handleClick}>
  Export to ScanGraph
</MajorControlButton>
