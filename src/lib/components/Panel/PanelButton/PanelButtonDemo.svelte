<script lang="ts">
    import MajorControlButton from '../../General/GeneralButton/GeneralButtonMajor.svelte'
    import  { demoData } from '$lib/const/demoData.ts'
    import { data } from '$lib/stores/dataStore.ts'
    import {setDefaultScarfPlotState} from "$lib/stores/scarfPlotsStore.js";
    const handleClick = async () => {
      data.set(demoData)
      setDefaultScarfPlotState()
    }
</script>

<MajorControlButton on:click={handleClick}>
    Reload demo
</MajorControlButton>
