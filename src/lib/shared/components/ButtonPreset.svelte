<script lang="ts">
  interface Props {
    label: string
    isActive?: boolean
    disabled?: boolean
    onclick?: (event: MouseEvent) => void
  }

  let { label, isActive = false, disabled = false, onclick = () => {} }: Props = $props()
</script>

<button class="preset-btn" class:active={isActive} {disabled} {onclick}>
  {label}
</button>

<style>
  .preset-btn {
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded);
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all var(--transition-normal) ease;
    color: var(--c-black);
  }

  .preset-btn:hover:not(:disabled) {
    border-color: var(--c-brand);
    color: var(--c-brand);
  }

  .preset-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .preset-btn.active {
    background-color: var(--c-brand);
    color: var(--c-white);
    border-color: var(--c-brand);
  }
</style>
