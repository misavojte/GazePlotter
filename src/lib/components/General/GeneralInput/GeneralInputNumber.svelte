<script lang="ts">
  import GeneralInputScaffold from '$lib/components/General/GeneralInput/GeneralInputScaffold.svelte'
  interface Props {
    value?: number;
    min?: number;
    label: string;
  }

  let { value = $bindable(0), min = 0, label }: Props = $props();
  const id = `text-${label.toLowerCase().replace(/\s+/g, '-')}`
</script>

<GeneralInputScaffold {label} {id}>
  <input {id} type="number" bind:value {min} />
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
  input:out-of-range {
    border-color: var(--c-error);
  }
</style>
