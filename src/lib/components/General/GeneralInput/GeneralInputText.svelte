<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  interface Props {
    value?: string;
    label: string;
  }

  let { value = $bindable(''), label }: Props = $props();
  const id = `text-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input {id} type="text" bind:value />
</GeneralInputScaffold>

<style>
  input {
    padding: 0.5rem;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    font-size: 14px;
    width: 170px;
    box-sizing: border-box;
  }
</style>
