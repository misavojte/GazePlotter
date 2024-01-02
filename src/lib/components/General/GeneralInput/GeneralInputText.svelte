<script lang="ts">
  import GeneralInputScaffold from './GeneralInputScaffold.svelte'
  export let value: string = '';
  export let legend: string;
  const id = `text-${legend.toLowerCase().replace(/\s+/g, '-')}`;
</script>

<GeneralInputScaffold {legend} {id}>
    <input id={id} type="text" bind:value />
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
