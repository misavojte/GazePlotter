<script lang="ts">
  import { tooltipAction } from '../Tooltip.svelte'

  // Props for the toolbar item
  interface Props {
    id: string
    label: string
    icon: string
    action?: (() => void) | null
    onclick?: (event: { id: string; event: MouseEvent }) => void
  }

  let { id, label, icon, action = null, onclick = () => {} }: Props = $props()

  let buttonElement: HTMLElement

  // Handle item click
  function handleClick(event: MouseEvent) {
    if (action) {
      action()
    }

    onclick({ id, event })
  }
</script>

<div class="tooltip-wrapper">
  <button
    class="toolbar-item"
    bind:this={buttonElement}
    on:click={handleClick}
    use:tooltipAction={{
      content: label,
      position: 'right',
      width: 100,
    }}
  >
    <div class="toolbar-item-icon">
      {@html icon}
    </div>
  </button>
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-item {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    margin: 4px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--c-darkgrey, #666);
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .toolbar-item:hover {
    background-color: var(--c-lightgrey, #eaeaea);
    color: var(--c-primary);
  }

  .toolbar-item-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
