<script lang="ts">
  import { ButtonPreset, InputCheck } from '$lib/shared/components'

  interface CheckboxItem {
    label: string
    sublabel?: string
    checked: boolean
    key: string
  }

  interface Props {
    title: string
    items: CheckboxItem[]
    onItemChange: (key: string, checked: boolean) => void
    showControls?: boolean
    maxHeight?: string
    hasError?: boolean
    errorMessage?: string
  }

  let {
    title,
    items,
    onItemChange,
    showControls = true,
    maxHeight = '260px',
    hasError = false,
    errorMessage = '',
  }: Props = $props()

  // Computed properties for select all/deselect all states
  const allChecked = $derived(
    items.length > 0 && items.every(item => item.checked)
  )
  const noneChecked = $derived(
    items.length === 0 || items.every(item => !item.checked)
  )

  function handleSelectAll() {
    items.forEach(item => {
      if (!item.checked) {
        onItemChange(item.key, true)
      }
    })
  }

  function handleDeselectAll() {
    items.forEach(item => {
      if (item.checked) {
        onItemChange(item.key, false)
      }
    })
  }

  function handleItemChange(key: string, checked: boolean) {
    onItemChange(key, checked)
  }
</script>

<div class="field-container">
  <div
    class="input-group"
    class:has-error={hasError}
    style:max-height={maxHeight === 'auto' ? 'none' : maxHeight}
  >
    <div class="group-header">
      <div class="group-title">{title}</div>
      {#if showControls}
        <div class="group-controls">
          <ButtonPreset
            label="Select All"
            isActive={allChecked}
            onclick={handleSelectAll}
          />
          <ButtonPreset
            label="Deselect All"
            isActive={noneChecked}
            onclick={handleDeselectAll}
          />
        </div>
      {/if}
    </div>

    <div class="group-content">
      {#if items.length === 0}
        <div class="empty-state">No items available</div>
      {:else}
        <div class="items-list">
          {#each items as item (item.key)}
            <InputCheck
              label={item.label}
              sublabel={item.sublabel}
              checked={item.checked}
              onchange={e => handleItemChange(item.key, e.detail)}
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if hasError && errorMessage}
    <div class="error-message">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="error-icon"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
          clip-rule="evenodd"
        />
      </svg>
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .field-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background-color: var(--c-white);
    box-shadow: var(--shadow-sm);
    transition: border-color var(--transition-normal);
    overflow: hidden;
    flex: 1;
    min-height: 0;
  }

  .input-group.has-error {
    border-color: var(--c-brand);
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.35rem 0.5rem 0.35rem 0.75rem;
    min-height: 2.2rem;
    border-bottom: 1px solid var(--c-border);
    background-color: var(--c-lightgrey);
  }

  .group-title {
    font-weight: 500;
    margin: 0;
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: 0.825rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .group-controls {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .group-content {
    display: block;
    overflow-y: auto;
    background-color: var(--c-white);
    min-height: 0;
    flex: 1;
    overscroll-behavior: contain;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem;
  }

  .empty-state {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--c-midgrey);
    font-style: italic;
    font-size: 0.85rem;
  }

  .error-message {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    color: var(--c-brand);
    font-size: 0.775rem;
    font-weight: 500;
    margin-top: 0.15rem;
    margin-left: 0.1rem;
    line-height: 1.3;
  }

  .error-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Custom scrollbar styling */
  .group-content::-webkit-scrollbar {
    width: 6px;
  }

  .group-content::-webkit-scrollbar-track {
    background: var(--c-lightgrey);
    border-radius: 3px;
  }

  .group-content::-webkit-scrollbar-thumb {
    background: var(--c-border);
    border-radius: 3px;
  }

  .group-content::-webkit-scrollbar-thumb:hover {
    background: var(--c-midgrey);
  }

  .group-content {
    scrollbar-width: thin;
    scrollbar-color: var(--c-border) var(--c-lightgrey);
  }

  @media (max-width: 600px) {
    .group-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .group-controls {
      justify-content: stretch;
      gap: 0.5rem;
    }

    /* Important: do not fix height heavily on mobile so it can shrink */
    .group-content {
      max-height: 250px !important;
    }
  }
</style>
