<script lang="ts">
  import { createBubbler, stopPropagation } from 'svelte/legacy';

  const bubble = createBubbler();
  interface Props {
    isDisabled?: boolean;
    children?: import('svelte').Snippet;
  }

  let { isDisabled = false, children }: Props = $props();
</script>

<button disabled={isDisabled} onpointerdown={stopPropagation(bubble('pointerdown'))} onclick={bubble('click')}>
  {@render children?.()}
</button>

<style>
  button {
    background-color: var(--c-lightgrey);
    border: none;
    color: var(--c-black);
    padding: 0.75em 1.5em;
    border-radius: var(--rounded-lg);
    text-align: center;
    text-decoration: none;
    display: inline-block;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
  }
  button:hover {
    background-color: var(--c-grey);
  }
  button:disabled {
    color: var(--c-midgrey);
    background-color: var(--c-lightgrey);
    cursor: not-allowed;
  }
</style>
