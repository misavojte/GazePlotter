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
  }

  let { title, items, onItemChange }: Props = $props()

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

  <div class="group-content">
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
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background-color: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem 0.5rem 1rem;
    border-bottom: 1px solid #eaeaea;
    background-color: #fafafa;
    border-radius: 6px 6px 0 0;
  }

  .group-title {
    font-weight: 600;
    margin: 0;
    flex: 1;
    min-width: 0;
    color: #333;
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
    height: 200px;
    overflow-y: auto;
    padding: 1rem;
    background-color: #fff;
    border-radius: 0 0 6px 6px;
  }

  /* Custom scrollbar styling */
  .group-content::-webkit-scrollbar {
    width: 6px;
  }

  .group-content::-webkit-scrollbar-track {
    background: #f8f8f8;
    border-radius: 3px;
  }

  .group-content::-webkit-scrollbar-thumb {
    background: #d0d0d0;
    border-radius: 3px;
  }

  .group-content::-webkit-scrollbar-thumb:hover {
    background: #b0b0b0;
  }

  /* Firefox scrollbar styling */
  .group-content {
    scrollbar-width: thin;
    scrollbar-color: #d0d0d0 #f8f8f8;
  }

  @media (max-width: 600px) {
    .group-header {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }

    .group-title {
      width: 100%;
    }

    .group-controls {
      margin-top: 0;
      justify-content: flex-start;
    }

    .group-content {
      height: 180px;
    }
  }
</style>
