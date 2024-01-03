<script lang="ts">
    import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
    import  { demoData } from '$lib/const/demoData.ts'
    import { data } from '$lib/stores/dataStore.ts'
    import {processingFileStateStore} from "$lib/stores/processingFileStateStore.ts";
    import {tick} from "svelte";
    const handleClick = async () => {
      processingFileStateStore.set('processing')
      await tick()
      data.set(demoData)
      await tick()
      processingFileStateStore.set('done')
    }
</script>

<MajorControlButton on:click={handleClick}>
    Reload demo
</MajorControlButton>
