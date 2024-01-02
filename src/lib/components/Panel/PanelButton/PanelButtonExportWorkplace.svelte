<script lang="ts">
    import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
    import { modalStore } from '$lib/stores/modalStore.js'
    import ModalContentDownloadWorkplace from '../../Modal/ModalContent/ModalContentDownloadWorkplace.svelte'

    const handleClick = () => {
      modalStore.open(ModalContentDownloadWorkplace, 'Download workplace')
    }
</script>

<MajorControlButton on:click={handleClick}>
    Download workplace
</MajorControlButton>
