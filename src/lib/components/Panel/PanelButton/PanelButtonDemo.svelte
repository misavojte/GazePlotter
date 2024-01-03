<script lang="ts">
    import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
    import { demoData } from '$lib/const/demoData'
    import { data } from '$lib/stores/dataStore'
    import {processingFileStateStore} from "$lib/stores/processingFileStateStore.js";
    import {tick} from "svelte";
    const handleClick = async () => {
      processingFileStateStore.set('processing')
      data.set(demoData)
      await tick()
      processingFileStateStore.set('done')
    }
</script>

<MajorControlButton on:click={handleClick}>
    Reload demo
</MajorControlButton>
