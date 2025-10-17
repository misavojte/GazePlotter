<script lang="ts">
  /**
   * Reusable container component that provides consistent styling for workspace items.
   * This component encapsulates the header and body styling used across different workspace components.
   * 
   * It can be used for:
   * - Interactive workspace items (with drag/resize functionality)
   * - Static indicator components (empty state, loading state)
   * 
   * @example
   * ```svelte
   * <WorkspaceItemContainer showResizeHandle={true}>
   *   {#snippet header()}
   *     <h3>My Title</h3>
   *   {/snippet}
   *   {#snippet body()}
   *     <p>My content</p>
   *   {/snippet}
   * </WorkspaceItemContainer>
   * ```
   */

  import type { Snippet } from 'svelte'

  interface Props {
    /** Content to render in the header section */
    header?: Snippet
    /** Content to render in the body section */
    body: Snippet
    /** Whether to show the resize handle icon in the bottom-right corner */
    showResizeHandle?: boolean
    /** Optional custom CSS class for the container */
    class?: string
    /** Additional inline styles for the container */
    style?: string
  }

  const {
    header,
    body,
    showResizeHandle = false,
    class: customClass = '',
    style = '',
  }: Props = $props()

  // Determine border radius based on whether resize handle is shown
  const borderRadiusClass = $derived(showResizeHandle ? '' : 'rounded-bottom')
</script>

<div class="workspace-item-container {customClass} {borderRadiusClass}" {style}>
  <!-- Header section (optional) -->
  {#if header}
    <div class="header">
      {@render header()}
    </div>
  {/if}

  <!-- Body section (required) -->
  <div class="body">
    {@render body()}
  </div>

  <!-- Resize handle (optional visual indicator) -->
  {#if showResizeHandle}
    <div class="resize-handle" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .workspace-item-container {
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    border: 1px solid #88888863;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: var(--c-lightgrey);
    flex-wrap: wrap;
    gap: 2px 5px;
    /* Ensure header respects parent's rounded corners */
    overflow: hidden;
    border-radius: var(--rounded-lg, 8px) var(--rounded-lg, 8px) 0 0;
  }

  .header :global(h3) {
    margin: 2px 0;
    flex-grow: 1;
    font-size: 14px;
    font-weight: 500;
  }

  .body {
    padding: 20px;
    flex-grow: 1;
    overflow: auto;
    border-radius: 10px 10px 0 0;
    background-color: var(--c-white);
  }

  /* Round all corners when there's no resize handle */
  .workspace-item-container.rounded-bottom {
    border-radius: var(--rounded-lg, 8px);
  }

  .workspace-item-container.rounded-bottom .body {
    border-radius: 10px;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    background: transparent;
    pointer-events: none;
  }

  .resize-handle::after {
    content: '';
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 8px;
    height: 8px;
    border-right: 2px solid rgba(0, 0, 0, 0.2);
    border-bottom: 2px solid rgba(0, 0, 0, 0.2);
  }
</style>

