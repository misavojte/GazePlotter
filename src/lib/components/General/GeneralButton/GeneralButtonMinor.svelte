<script lang="ts">
  interface Props {
    isDisabled?: boolean;
    isIcon?: boolean;
    children?: import('svelte').Snippet;
    onclick?: (event: MouseEvent) => void;
  }

  let { isDisabled = false, isIcon = true, children, onclick = () => {} }: Props = $props();
</script>

<button
  disabled={isDisabled}
  class:isIcon={isIcon}
  {onclick}
>
  {@render children?.()}
</button>

<style>
  button {
    background: none;
    border: 1px solid var(--c-darkgrey);
    border-radius: var(--rounded);
    color: var(--c-black);
    padding: 0.25em 0.5em;
    text-align: center;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    display: inline-flex;
    height: 34px;
    min-width: 34px;
    font-size: 16px;
    cursor: pointer;
  }
  button.isIcon {
    width: 34px;
  }
  button:hover {
    border: 1px solid var(--c-brand);
    color: var(--c-brand);
  }
  button:disabled {
    cursor: not-allowed;
    color: var(--c-darkgrey);
    border: 1px solid var(--c-midgrey);
  }
</style>
