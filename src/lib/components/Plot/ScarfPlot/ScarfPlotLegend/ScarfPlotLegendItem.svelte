<script lang="ts">
  import type { SingleStylingScarfFillingType } from '$lib/type/Filling/ScarfFilling'
  export let legend: SingleStylingScarfFillingType
  export let isVisibility = false
</script>

<div class="legendItem {legend.identifier}">
    <svg width="20" height={legend.height || '12'}>
        {#if isVisibility}
            <line class={legend.identifier} x1="0" x2="100%" y1="50%" y2="50%" stroke={legend.color}/>
        {:else}
            <rect class={legend.identifier} width="100%" height="100%" fill={legend.color}/>
        {/if}
    </svg>
    <div>
        {legend.name}
    </div>
</div>

<style>
    .legendItem {
        display: flex;
        gap: 8px;
        font-size: 12px;
        align-items: center;
        width: 115px;
        line-height: 1;
    }
</style>
