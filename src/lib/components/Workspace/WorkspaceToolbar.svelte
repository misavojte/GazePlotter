<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  // Configuration for toolbar items
  export let actionItems = []
  export let width = '48px'
  export let accentColor = 'var(--c-primary, #4a8cff)'

  // Event dispatcher for toolbar actions
  const dispatch = createEventDispatcher()

  // Handle toolbar item click
  function handleItemClick(event, item) {
    if (item && item.action) {
      item.action()
    }
    dispatch('action', { id: item ? item.id : 'default', event })
  }

  // Handle add new placeholder click
  function handlePlaceholderClick(event) {
    dispatch('action', { id: 'add-new', event })
  }
</script>

<div
  class="workspace-toolbar"
  style="--toolbar-width: {width}; --accent-color: {accentColor};"
>
  <div class="toolbar-content">
    {#if actionItems.length > 0}
      {#each actionItems as item}
        <button
          class="toolbar-item"
          title={item.label}
          on:click={e => handleItemClick(e, item)}
        >
          <div class="toolbar-item-icon">
            {@html item.icon}
          </div>
        </button>
      {/each}
    {:else}
      <div class="toolbar-placeholder" on:click={handlePlaceholderClick}>
        <span>+</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .workspace-toolbar {
    position: relative;
    top: 0;
    left: 0;
    width: var(--toolbar-width);
    height: 100%;
    background-color: var(--c-grey);
    border-right: 1px solid var(--c-darkgrey, #eaeaea);
    z-index: -1;
  }

  .toolbar-content {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px 0;
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
    color: var(--accent-color);
  }

  .toolbar-item-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px dashed var(--c-lightgrey, #eaeaea);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-darkgrey, #666);
    font-size: 20px;
    cursor: pointer;
    margin-top: 20px;
  }

  .toolbar-placeholder:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  /* Media query to hide toolbar on very small screens */
  @media (max-width: 480px) {
    .workspace-toolbar {
      width: 40px;
    }
  }
</style>
