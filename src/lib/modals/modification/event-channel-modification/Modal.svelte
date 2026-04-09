<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { InputCheck, InputColor, InputText } from '$lib/shared/components'
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getEventChannels, getHiddenEventChannels } from '$lib/data/engine'
  import type { ExtendedInterpretedDataType } from '$lib/data/types'
  import { flip } from 'svelte/animate'
  import Empty from '$lib/shared/components/Empty.svelte'
  import { getStimuliOptions } from '$lib/plots/shared'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import ArrowDownAZ from 'lucide-svelte/icons/arrow-down-a-z'
  import Info from 'lucide-svelte/icons/info'
  import { createDragReorder } from '../shared/dragReorder'
  import { tooltipAction } from '$lib/tooltip'

  interface Props {
    selectedStimulus?: string
    source: string
  }

  let {
    selectedStimulus = $bindable('0'),
    source,
  }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()

  const isValidMatch = (displayedName: string): boolean =>
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined

  const deepCopyChannels = (
    channels: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] =>
    channels.map(ch => ({
      id: ch.id,
      originalName: ch.originalName,
      displayedName: ch.displayedName,
      color: ch.color,
    }))

  const rawChannels = getEventChannels(engine, parseInt(selectedStimulus))
  let channelObjects: ExtendedInterpretedDataType[] = $state(deepCopyChannels(rawChannels))
  let lastSelectedStimulus = $state(selectedStimulus)

  const initialHidden = getHiddenEventChannels(engine, parseInt(selectedStimulus))
  let hiddenChannelIds: number[] = $state([...initialHidden])
  const hiddenSet = $derived(new Set(hiddenChannelIds))

  $effect(() => {
    if (selectedStimulus !== lastSelectedStimulus) {
      const rawChannels = getEventChannels(engine, parseInt(selectedStimulus))
      channelObjects = deepCopyChannels(rawChannels)
      lastSelectedStimulus = selectedStimulus

      const nextHidden = getHiddenEventChannels(engine, parseInt(selectedStimulus))
      hiddenChannelIds = [...nextHidden]
    }
  })

  // --- Grouping ---

  interface ChannelGroup {
    key: number
    members: ExtendedInterpretedDataType[]
  }

  const groupedChannels = $derived.by<ChannelGroup[]>(() => {
    const seen = new Set<string>()
    const groups: ChannelGroup[] = []

    for (const ch of channelObjects) {
      const trimmed = (ch.displayedName || '').trim()
      if (!isValidMatch(trimmed)) {
        groups.push({ key: ch.id, members: [ch] })
        continue
      }
      if (seen.has(trimmed)) continue
      seen.add(trimmed)
      const members = channelObjects.filter(
        c => (c.displayedName || '').trim() === trimmed
      )
      groups.push({ key: members[0].id, members })
    }

    return groups
  })

  const hasGroups = $derived(groupedChannels.some(g => g.members.length > 1))

  // --- Name editing ---

  const handleNameInput = (
    ch: ExtendedInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: ChannelGroup
  ) => {
    if (isLeader && group.members.length > 1) {
      const memberIds = new Set(group.members.map(m => m.id))
      for (const c of channelObjects) {
        if (memberIds.has(c.id)) {
          c.displayedName = newName
        }
      }
    } else {
      const original = channelObjects.find(c => c.id === ch.id)
      if (original) {
        original.displayedName = newName

        const trimmedName = (newName || '').trim()
        if (isValidMatch(trimmedName)) {
          const groupMember = channelObjects.find(
            c =>
              c.id !== ch.id &&
              (c.displayedName || '').trim() === trimmedName
          )
          if (groupMember) {
            const isGroupHidden = hiddenChannelIds.includes(groupMember.id)
            if (isGroupHidden) {
              if (!hiddenChannelIds.includes(ch.id)) {
                hiddenChannelIds = [...hiddenChannelIds, ch.id]
              }
            } else {
              hiddenChannelIds = hiddenChannelIds.filter(id => id !== ch.id)
            }
          }
        }
      }
    }
  }

  // --- Visibility toggle ---

  const toggleActive = (group: ChannelGroup, active: boolean) => {
    const affectedIds = group.members.map(c => c.id)
    if (active) {
      hiddenChannelIds = hiddenChannelIds.filter(id => !affectedIds.includes(id))
    } else {
      hiddenChannelIds = Array.from(new Set([...hiddenChannelIds, ...affectedIds]))
    }
  }

  // --- Color change ---

  const handleColorInput = (group: ChannelGroup, newColor: string) => {
    const leaderId = group.members[0].id
    channelObjects = channelObjects.map(c =>
      c.id === leaderId ? { ...c, color: newColor } : c
    )
  }

  // --- Drag reorder ---

  let dragGroupKey: number | null = $state(null)

  const dragHandle = createDragReorder({
    itemSelector: '.channel-card',
    containerSelector: '.channel-grid',
    onDragStart: key => {
      dragGroupKey = key
    },
    onDragEnd: () => {
      dragGroupKey = null
    },
    onReorder: (fromIndex, toIndex) => {
      const current = groupedChannels
      const dragged = current[fromIndex]
      const without = current.filter((_, i) => i !== fromIndex)
      without.splice(toIndex, 0, dragged)

      const newOrder: ExtendedInterpretedDataType[] = []
      for (const g of without) {
        for (const m of g.members) {
          newOrder.push(channelObjects.find(c => c.id === m.id)!)
        }
      }
      channelObjects = newOrder
    },
  })

  // --- Sort ---

  let showSortMenu = $state(false)

  const naturalSort = (a: string, b: string): number => {
    const aParts = a.match(/(\d+|\D+)/g) || []
    const bParts = b.match(/(\d+|\D+)/g) || []
    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      if (/^\d+$/.test(aParts[i]) && /^\d+$/.test(bParts[i])) {
        const diff = parseInt(aParts[i], 10) - parseInt(bParts[i], 10)
        if (diff !== 0) return diff
      } else {
        const cmp = aParts[i].localeCompare(bParts[i])
        if (cmp !== 0) return cmp
      }
    }
    return aParts.length - bParts.length
  }

  const sortChannels = (
    column: 'originalName' | 'displayedName',
    direction: 'asc' | 'desc'
  ) => {
    channelObjects = [...channelObjects].sort((a, b) => {
      const cmp = naturalSort(a[column], b[column])
      return direction === 'asc' ? cmp : -cmp
    })
    showSortMenu = false
  }

  const clickOutsideSort = (node: HTMLElement) => {
    const handleClick = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) showSortMenu = false
    }
    document.addEventListener('click', handleClick, true)
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true)
      },
    }
  }

  // --- Submit ---

  const handleSubmit = () => {
    const cleanedChannels = channelObjects.map(ch => ({
      id: ch.id,
      originalName: ch.originalName,
      displayedName: (ch.displayedName || '').trim(),
      color: ch.color,
    }))

    const stimulusId = parseInt(selectedStimulus)

    const hiddenUniqueSorted = Array.from(
      new Set(hiddenChannelIds.filter(v => Number.isInteger(v) && v >= 0))
    ).sort((a, b) => a - b)

    if (
      !workspace.updateEventChannels(
        cleanedChannels,
        stimulusId,
        source,
        hiddenUniqueSorted
      )
    ) {
      return
    }

    modalState.close()
  }

  const handleCancel = () => {
    modalState.close()
  }

  const stimuliOption = getStimuliOptions(engine)
</script>

<Section>
  <Select
    label="For stimulus"
    options={stimuliOption}
    bind:value={selectedStimulus}
  />
</Section>

<Section>
  <div class="section-title-row">
    <span class="section-title">Event channels</span>
    {#if groupedChannels.length > 0}
      <div class="sort-wrapper" use:clickOutsideSort>
        <button
          class="tool-button"
          class:active={showSortMenu}
          onclick={() => { showSortMenu = !showSortMenu }}
          aria-label="Sort event channels"
          use:tooltipAction={{ content: 'Sort', position: 'bottom', disabled: showSortMenu }}
        >
          <ArrowDownAZ size={'1em'} />
        </button>
        {#if showSortMenu}
          <div class="sort-menu">
            <button class="sort-option" onclick={() => sortChannels('originalName', 'asc')}>Original name A–Z</button>
            <button class="sort-option" onclick={() => sortChannels('originalName', 'desc')}>Original name Z–A</button>
            <button class="sort-option" onclick={() => sortChannels('displayedName', 'asc')}>Displayed name A–Z</button>
            <button class="sort-option" onclick={() => sortChannels('displayedName', 'desc')}>Displayed name Z–A</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if groupedChannels.length === 0}
    <Empty message="No event channels found in stimulus" />
  {:else}
    <div class="channel-grid">
      <div class="channel-column-labels">
        <span>Move</span>
        <span>Original</span>
        <span>Displayed</span>
        <span>Color</span>
        <span>Visible</span>
      </div>
      {#each groupedChannels as group (group.key)}
        {@const isActive = !hiddenSet.has(group.members[0].id)}
        <div
          class="channel-card"
          class:dragging={dragGroupKey === group.key}
          data-group-key={group.key}
          animate:flip={{ duration: 200 }}
        >
          {#each group.members as ch, i (ch.id)}
            {@const isLeader = i === 0}
            <div
              class="channel-row"
              class:leader={isLeader}
              class:inactive={!isActive}
            >
              <div class="col-handle">
                {#if isLeader}
                  <div
                    class="drag-handle"
                    class:disabled-control={!isActive}
                    use:dragHandle={group.key}
                  >
                    <GripVertical size={'1em'} />
                  </div>
                {/if}
              </div>
              <div class="col-original">{ch.originalName}</div>
              <div class="col-displayed">
                <InputText
                  label="Displayed name"
                  showLabel={false}
                  fill={true}
                  disabled={!isActive}
                  ariaLabel={`Displayed name for ${ch.originalName}`}
                  value={ch.displayedName}
                  oninput={e => handleNameInput(ch, e.detail, isLeader, group)}
                />
              </div>
              <div class="col-color">
                {#if isLeader}
                  <div class:disabled-control={!isActive}>
                    <InputColor
                      label="Color"
                      showLabel={false}
                      width={35}
                      ariaLabel={`Color for ${ch.originalName}`}
                      value={ch.color}
                      oninput={event =>
                        isActive && handleColorInput(group, event.detail)}
                    />
                  </div>
                {/if}
              </div>
              <div class="col-active">
                {#if isLeader}
                  <InputCheck
                    label=""
                    ariaLabel="Is active"
                    size="lg"
                    checked={isActive}
                    onchange={e => toggleActive(group, e.detail)}
                  />
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/each}
      {#if !hasGroups}
        <div class="channel-hint">
          <div class="col-handle">
            <Info size={'1em'} />
          </div>
          <div class="hint-text" style="grid-column: 2 / -1;">Name channels the same to <strong>group</strong> them together</div>
        </div>
      {/if}
    </div>
    <ModalButtons
      buttons={[
        {
          label: 'Apply',
          onclick: handleSubmit,
          variant: 'primary',
        },
        {
          label: 'Cancel',
          onclick: handleCancel,
        },
      ]}
    />
  {/if}
</Section>

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

  .channel-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(600px, 100%);
    margin-bottom: 20px;
  }

  .channel-column-labels {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 40px 40px;
    gap: 8px;
    padding: 0 12px;
    font-size: 10px;
    color: var(--c-midgrey);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .channel-column-labels span:first-child {
    margin-left: -12px;
  }

  .channel-column-labels span:nth-child(4),
  .channel-column-labels span:nth-child(5) {
    text-align: center;
  }

  .channel-hint {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 40px 40px;
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

  .hint-text {
    font-size: 13px;
    color: var(--c-black);
  }

  .channel-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .channel-card.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .channel-card.dragging > * {
    visibility: hidden;
  }

  .channel-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 40px 40px;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--c-darkwhite);
  }

  .channel-row:not(.leader) {
    border-top: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .channel-row.inactive {
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

  .col-original {
    font-size: 14px;
    color: var(--c-midgrey);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .col-color {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .col-active {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
