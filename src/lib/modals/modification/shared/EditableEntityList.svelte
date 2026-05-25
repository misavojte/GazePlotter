<script lang="ts">
  import type { Snippet } from 'svelte'
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import Empty from '$lib/shared/components/Empty.svelte'
  import { InputCheck, InputColor, InputText } from '$lib/shared/components'
  import ArrowDownAZ from 'lucide-svelte/icons/arrow-down-a-z'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import Info from 'lucide-svelte/icons/info'
  import { tooltipAction } from '$lib/tooltip'
  import { createListReorder, type ListReorderConfig } from './listReorder.action'
  import { clickOutside } from './clickOutside.action'
  import type { EntityGroup } from './groupedEntityEditor.svelte'
  import type {
    BaseInterpretedDataType,
    ExtendedInterpretedDataType,
  } from '$lib/data/types'

  export interface TableColumn {
    label: string
    width: string
    align?: 'center'
    type: 'handle' | 'readonly' | 'text' | 'color' | 'checkbox'
    key?: string
    leaderOnly?: boolean
  }

  interface SortColumn {
    label: string
    column: string
  }

  interface GroupedCallbacks {
    hiddenSet: Set<number>
    onNameInput: (
      item: ExtendedInterpretedDataType,
      name: string,
      isLeader: boolean,
      group: EntityGroup
    ) => void
    onColorInput: (group: EntityGroup, color: string) => void
    onToggleActive: (group: EntityGroup, active: boolean) => void
  }

  interface Props {
    items: (BaseInterpretedDataType | EntityGroup)[]
    title: string
    emptyMessage: string
    columns: TableColumn[]
    sortColumns: SortColumn[]
    hintText?: string
    grouped?: GroupedCallbacks
    onItemChange?: (id: number, key: string, value: string) => void
    onSort: (column: string, direction: 'asc' | 'desc') => void
    onReorder: ListReorderConfig['onReorder']
    toolbar?: Snippet
  }

  let {
    items,
    title,
    emptyMessage,
    columns,
    sortColumns,
    hintText,
    grouped,
    onItemChange,
    onSort,
    onReorder,
    toolbar,
  }: Props = $props()

  const gridTemplate = $derived(columns.map(c => c.width).join(' '))

  let showSortMenu = $state(false)
  let dragItemKey: number | null = $state(null)

  const dragHandle = createListReorder({
    itemSelector: '.entity-card',
    containerSelector: '.entity-grid',
    onDragStart: key => {
      dragItemKey = key
    },
    onDragEnd: () => {
      dragItemKey = null
    },
    onReorder: (from, to) => onReorder(from, to),
  })
</script>

<div class="section-title-row">
  <span class="section-title">{title}</span>
  {#if items.length > 0}
    <div class="title-actions">
      {#if toolbar}
        {@render toolbar()}
      {/if}
      <div class="sort-wrapper" use:clickOutside={() => { showSortMenu = false }}>
        <button
          class="tool-button"
          class:active={showSortMenu}
          onclick={() => { showSortMenu = !showSortMenu }}
          aria-label="Sort {title.toLowerCase()}"
          use:tooltipAction={{ content: 'Sort', position: 'bottom', disabled: showSortMenu }}
        >
          <ArrowDownAZ size={'1em'} />
        </button>
        {#if showSortMenu}
          <div class="sort-menu">
            {#each sortColumns as col}
              <button
                class="sort-option"
                onclick={() => { onSort(col.column, 'asc'); showSortMenu = false }}
              >{col.label} A–Z</button>
              <button
                class="sort-option"
                onclick={() => { onSort(col.column, 'desc'); showSortMenu = false }}
              >{col.label} Z–A</button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if items.length === 0}
  <Empty message={emptyMessage} />
{:else}
  <div class="entity-grid" style:--grid-columns={gridTemplate}>
    <div class="column-labels" style:grid-template-columns={gridTemplate}>
      {#each columns as col}
        <span class:center-align={col.align === 'center'}>{col.label}</span>
      {/each}
    </div>

    {#each items as item, index (item.id)}
      <div
        class="entity-card"
        class:dragging={dragItemKey === item.id}
        animate:flip={{ duration: dragItemKey === item.id ? 0 : 150, easing: cubicOut }}
      >
        {#if grouped}
          {@const group = item as EntityGroup}
          {@const isActive = !grouped.hiddenSet.has(group.members[0].id)}
          {#each group.members as member, i (member.id)}
            {@const isLeader = i === 0}
            <div
              class="entity-row"
              class:member={!isLeader}
              style:grid-template-columns={gridTemplate}
              class:leader={isLeader}
              class:inactive={!isActive}
            >
              {#each columns as col}
                {#if col.type === 'handle'}
                  <div class="col-handle">
                    {#if isLeader}
                      <div class="drag-handle" class:disabled-control={!isActive} use:dragHandle={group.id}>
                        <GripVertical size={'1em'} />
                      </div>
                    {/if}
                  </div>
                {:else if col.type === 'readonly'}
                  <div class="col-readonly">{(member as unknown as Record<string, string>)[col.key ?? '']}</div>
                {:else if col.type === 'text'}
                  <div>
                    <InputText
                      label="Displayed name"
                      showLabel={false}
                      fill={true}
                      disabled={!isActive}
                      ariaLabel={`Displayed name for ${member.originalName}`}
                      value={member.displayedName}
                      oninput={e => grouped.onNameInput(member, e.detail, isLeader, group)}
                    />
                  </div>
                {:else if col.type === 'color' && isLeader}
                  <div class="col-center">
                    <div class:disabled-control={!isActive}>
                      <InputColor
                        label="Color"
                        showLabel={false}
                        width={35}
                        ariaLabel={`Color for ${member.originalName}`}
                        value={member.color}
                        oninput={event => isActive && grouped.onColorInput(group, event.detail)}
                      />
                    </div>
                  </div>
                {:else if col.type === 'checkbox' && isLeader}
                  <div class="col-center">
                    <InputCheck
                      label=""
                      ariaLabel="Is active"
                      size="lg"
                      checked={isActive}
                      onchange={e => grouped.onToggleActive(group, e.detail)}
                    />
                  </div>
                {:else if (col.type === 'color' || col.type === 'checkbox') && !isLeader}
                  <div></div>
                {/if}
              {/each}
            </div>
          {/each}
        {:else}
          {@const flat = item as BaseInterpretedDataType}
          <div class="entity-row" style:grid-template-columns={gridTemplate}>
            {#each columns as col}
              {#if col.type === 'handle'}
                <div class="col-handle">
                  <div class="drag-handle" use:dragHandle={flat.id}>
                    <GripVertical size={'1em'} />
                  </div>
                </div>
              {:else if col.type === 'readonly'}
                <div class="col-readonly">{(flat as unknown as Record<string, string>)[col.key ?? '']}</div>
              {:else if col.type === 'text'}
                <div>
                  <InputText
                    label="Displayed name"
                    showLabel={false}
                    fill={true}
                    ariaLabel={`Displayed name for ${flat.originalName}`}
                    value={flat.displayedName}
                    oninput={e => onItemChange?.(flat.id, col.key ?? '', e.detail)}
                  />
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    {#if hintText}
      <div class="entity-hint">
        <div class="hint-icon"><Info size={'1em'} /></div>
        <div class="hint-text">{@html hintText}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .section-title {
    font-weight: 600;
  }

  .title-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .sort-wrapper {
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

  .sort-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: var(--c-white);
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 10;
    min-width: 180px;
    overflow: hidden;
  }

  .sort-option {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    font-size: 13px;
    color: var(--c-black);
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .sort-option:hover {
    background-color: var(--c-darkwhite);
  }

  .sort-option:not(:last-child) {
    border-bottom: 1px solid var(--c-border);
  }

  .entity-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(600px, 100%);
    margin-bottom: 20px;
  }

  .column-labels {
    display: grid;
    gap: 8px;
    padding: 0 12px;
    font-size: 10px;
    color: var(--c-midgrey);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .column-labels span:first-child {
    margin-left: -12px;
  }

  .center-align {
    text-align: center;
  }

  .entity-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .entity-card.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .entity-row {
    display: grid;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--c-darkwhite);
  }

  .entity-row.member {
    border-top: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .entity-row.inactive {
    opacity: 0.45;
    filter: grayscale(0.2);
  }

  .disabled-control {
    opacity: 0.45;
    pointer-events: none;
    filter: grayscale(0.2);
  }

  .col-handle {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drag-handle {
    cursor: grab;
    color: var(--c-midgrey);
    display: flex;
    align-items: center;
    padding: 2px 0;
    transition: color 0.1s ease;
  }

  .drag-handle:hover {
    color: var(--c-darkgrey);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .col-readonly {
    font-size: 14px;
    color: var(--c-midgrey);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .entity-hint {
    display: grid;
    grid-template-columns: 28px 1fr;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    border: 1px dashed var(--c-midgrey);
    border-radius: var(--rounded-md);
    background-color: var(--c-darkwhite);
    color: var(--c-black);
    height: 50px;
    box-sizing: border-box;
  }

  .hint-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hint-text {
    font-size: 13px;
    color: var(--c-black);
  }
</style>
