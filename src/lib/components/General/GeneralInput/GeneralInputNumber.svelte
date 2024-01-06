<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  export let value = 0
  export let min = 0
  export let legend: string
  const id = `text-${legend.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {legend} {id}>
  <input {id} type="number" bind:value {min} />
</GeneralInputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    width: 170px;
    box-sizing: border-box;
  }
</style>
