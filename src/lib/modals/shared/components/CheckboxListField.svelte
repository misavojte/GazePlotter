<script lang="ts">
  import type { Snippet } from 'svelte'
  import { ButtonPreset, InputCheck, InputText } from '$lib/shared/components'

  interface CheckboxItem {
    label: string
    sublabel?: string
    checked: boolean
    key: string
    disabled?: boolean
    reason?: string
  }

  interface Props {
    title: string
    items: CheckboxItem[]
    onItemChange: (key: string, checked: boolean) => void
    /** Optional row between the search bar and the list — selection presets
     *  such as participant-group chips. */
    presets?: Snippet
    hasError?: boolean
    errorMessage?: string
  }

  let {
    title,
    items,
    onItemChange,
    presets,
    hasError = false,
    errorMessage = '',
  }: Props = $props()

  /** The list renders at natural height (the surrounding modal is the single
   *  scroll context), so long lists get a search bar automatically. */
  const SEARCHABLE_FROM = 8

  let query = $state('')
  const searchable = $derived(items.length >= SEARCHABLE_FROM)
  const normalizedQuery = $derived(query.trim().toLowerCase())
  const isFiltering = $derived(searchable && normalizedQuery.length > 0)

  const shownItems = $derived(
    isFiltering
      ? items.filter(
          item =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            (item.sublabel?.toLowerCase().includes(normalizedQuery) ?? false)
        )
      : items
  )

  // Bulk actions operate on the enabled subset of the SHOWN items: without a
  // query that is the whole list; with a query it is the matches. With no
  // enabled items there is nothing to act on: both buttons disable, and
  // neither reads as active (no vacuous [].every highlight).
  const enabledShown = $derived(shownItems.filter(item => !item.disabled))
  const bulkDisabled = $derived(enabledShown.length === 0)
  const allChecked = $derived(
    enabledShown.length > 0 && enabledShown.every(item => item.checked)
  )
  const noneChecked = $derived(
    enabledShown.length > 0 && enabledShown.every(item => !item.checked)
  )

  const checkedCount = $derived(items.filter(item => item.checked).length)

  function setShown(checked: boolean) {
    shownItems.forEach(item => {
      if (!item.disabled && item.checked !== checked) {
        onItemChange(item.key, checked)
      }
    })
  }

  /** A disabled item's sublabel carries the reason it cannot be selected. */
  function itemSublabel(item: CheckboxItem): string | undefined {
    if (!item.disabled || !item.reason) return item.sublabel
    return item.sublabel ? `${item.sublabel} · ${item.reason}` : item.reason
  }
</script>

<div class="field-container">
  <div class="input-group" class:has-error={hasError}>
    <div class="group-header">
      <div class="group-title">
        {title}
        <span class="group-count">{checkedCount}/{items.length}</span>
      </div>
      <div class="group-controls">
        <ButtonPreset
          label={isFiltering ? 'Select Found' : 'Select All'}
          isActive={allChecked}
          disabled={bulkDisabled}
          onclick={() => setShown(true)}
        />
        <ButtonPreset
          label={isFiltering ? 'Deselect Found' : 'Deselect All'}
          isActive={noneChecked}
          disabled={bulkDisabled}
          onclick={() => setShown(false)}
        />
      </div>
    </div>

    {#if searchable}
      <div class="search-row">
        <InputText
          label=""
          showLabel={false}
          bind:value={query}
          placeholder="Search"
          ariaLabel={`Search ${title}`}
          fill
        />
      </div>
    {/if}

    {#if presets}
      <div class="presets-row">
        {@render presets()}
      </div>
    {/if}

    <div class="group-content">
      {#if items.length === 0}
        <div class="empty-state">No items available</div>
      {:else if shownItems.length === 0}
        <div class="empty-state">No matches</div>
      {:else}
        <div class="items-list">
          {#each shownItems as item (item.key)}
            <InputCheck
              label={item.label}
              sublabel={itemSublabel(item)}
              checked={item.checked}
              disabled={item.disabled}
              onchange={e => onItemChange(item.key, e.detail)}
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
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-weight: 500;
    margin: 0;
    flex: 1;
    min-width: 0;
    color: var(--c-text);
    font-size: 0.825rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .group-count {
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--c-midgrey);
    letter-spacing: 0;
  }

  .group-controls {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .search-row {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .group-content {
    background-color: var(--c-white);
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
  }
</style>
