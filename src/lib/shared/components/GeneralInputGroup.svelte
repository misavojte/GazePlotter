<script lang="ts">
  import GeneralInputCheck from './GeneralInputCheck.svelte'
  import GeneralButtonPreset from './GeneralButtonPreset.svelte'

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
    maxHeight?: number
  }

  let { title, items, onItemChange, maxHeight = 400 }: Props = $props()

  // Computed properties for select all/deselect all states
  const allChecked = $derived(items.every(item => item.checked))
  const noneChecked = $derived(items.every(item => !item.checked))

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

<div class="input-group">
  <div class="group-header">
    <div class="group-title">{title}</div>
    <div class="group-controls">
      <GeneralButtonPreset
        label="Select All"
        isActive={allChecked}
        onclick={handleSelectAll}
      />
      <GeneralButtonPreset
        label="Deselect All"
        isActive={noneChecked}
        onclick={handleDeselectAll}
      />
    </div>
  </div>

  <div class="group-content" style="max-height: {maxHeight}px;">
    {#each items as item (item.key)}
      <GeneralInputCheck
        label={item.label}
        sublabel={item.sublabel}
        checked={item.checked}
        onchange={e => handleItemChange(item.key, e.detail)}
      />
    {/each}
  </div>
</div>

<style>
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #eaeaea;
  }

  .group-title {
    font-weight: 600;
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .group-controls {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .group-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: scroll;
    padding-right: 0.5rem;
    margin-right: -0.5rem;
  }

  /* Custom scrollbar styling */
  .group-content::-webkit-scrollbar {
    width: 8px;
  }

  .group-content::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .group-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }

  .group-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  @media (max-width: 600px) {
    .group-header {
      flex-direction: column;
      gap: 0.5rem;
    }

    .group-title {
      width: 100%;
    }

    .group-controls {
      margin-top: 0;
    }
  }
</style>
