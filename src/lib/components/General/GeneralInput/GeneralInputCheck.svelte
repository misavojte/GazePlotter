<script lang="ts">
  import { createBubbler } from 'svelte/legacy';

  const bubble = createBubbler();
  interface Props {
    label: string;
    checked?: boolean;
  }

  let { label, checked = $bindable(false) }: Props = $props();
</script>

<label>
  <input type="checkbox" bind:checked onchange={bubble('change')} />
  {label}
</label>

<style>
  label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  input[type='checkbox'] {
    margin-right: 0.5em;
    accent-color: var(--c-brand);
    cursor: pointer;
  }
</style>
