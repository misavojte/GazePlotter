<script lang="ts">
  import Replace from 'lucide-svelte/icons/replace'
  import { tooltipAction } from '$lib/tooltip'
  import PatternRenamingTool from './PatternRenamingTool.svelte'
  import { clickOutside } from './clickOutside'

  interface Props {
    onRename: (findText: string, replaceText: string) => void
  }

  let { onRename }: Props = $props()
  let showPanel = $state(false)
</script>

<div class="rename-wrapper" use:clickOutside={() => { showPanel = false }}>
  <button
    class="tool-button"
    class:active={showPanel}
    onclick={() => { showPanel = !showPanel }}
    aria-label="Bulk rename"
    use:tooltipAction={{ content: 'Bulk rename', position: 'bottom', disabled: showPanel }}
  >
    <Replace size={'1em'} />
  </button>
  {#if showPanel}
    <div class="rename-dropdown">
      <PatternRenamingTool
        onRenameCommand={(findText, replaceText) => {
          onRename(findText, replaceText)
          showPanel = false
        }}
      />
    </div>
  {/if}
</div>

<style>
  .rename-wrapper {
    position: relative;
  }

  .tool-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    color: var(--c-darkgrey);
    width: 30px;
    height: 30px;
    cursor: pointer;
    transition: color 0.1s ease, border-color 0.1s ease, background-color 0.1s ease;
  }

  .tool-button:hover {
    color: var(--c-brand);
    border-color: var(--c-brand);
  }

  .tool-button.active {
    color: var(--c-brand);
    border-color: var(--c-brand);
    background-color: #f0f4ff;
  }

  .rename-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    min-width: 340px;
    padding: 10px 12px;
  }
</style>
