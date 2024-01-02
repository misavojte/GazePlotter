<script lang="ts">
  import { getParticipant, getSegment } from '$lib/stores/dataStore.js'
  import { fade } from 'svelte/transition'

    export let x: number
    export let y: number
    export let width: number
    export let stimulusId: number
    export let participantId: number
    export let segmentId: number

    const isOrdinalOnly: boolean = false

    $: style = `
      left: ${x}px;
      top: ${y}px;
      width: ${width}px;
    `
    $: participant = getParticipant(participantId)
    $: segment = getSegment(stimulusId, participantId, segmentId)
    $: aoi = segment.aoi.length > 0 ? segment.aoi.map((aoi) => aoi.displayedName).join(', ') : 'None'

</script>

<aside class="tooltip" style={style} transition:fade={{ duration: 200 }}>
    <div>
        <div>Participant</div>
        <div>{participant.displayedName}</div>
    </div>
    <div>
        <div>Category</div>
        <div>{segment.category.displayedName}</div>
    </div>
    {#if segment.category.displayedName === 'Fixation'}
        <div>
            <div>Area of Interest</div>
            <div>{aoi}</div>
        </div>
    {/if}
    <div>
        <div>Order index</div>
        <div>{segmentId}</div>
    </div>
    {#if !isOrdinalOnly}
      <div>
        <div>Start and end</div>
        <div>{segment.start.toFixed(1)} - {segment.end.toFixed(1)} ms</div>
      </div>
      <div>
        <div>Event duration</div>
        <div>{(segment.end - segment.start).toFixed(1)} ms</div>
      </div>
    {/if}
</aside>

<style>
    aside {
        position: absolute;
        font-size: 12px;
        background: #6d6d6d;
        color: rgba(255, 255, 255, 0.8);
        transition: 0.3s ease-in-out;
        border-radius: 3px;
        z-index: 3;
    }
    .tooltip > div {
        padding: 5px;
    }
    .tooltip > div:last-child {
        border-bottom: none;
    }
    .tooltip > div > div:first-child {
        font-size: 70%;
        text-transform: uppercase;
    }
</style>
