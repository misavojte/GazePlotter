<script lang="ts">
  interface Props {
    label: string
    isActive?: boolean
  }

  let { label, isActive = false }: Props = $props()
</script>

<button class="preset-btn" class:active={isActive} on:click>
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
    transition: all 0.2s ease;
    color: var(--c-black);
  }

  .preset-btn:hover {
    border-color: var(--c-brand);
    color: var(--c-brand);
  }

  .preset-btn.active {
    background-color: var(--c-brand);
    color: var(--c-white);
    border-color: var(--c-brand);
  }
</style>
