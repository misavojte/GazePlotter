<script lang="ts">
  import Radio from '$lib/shared/components/Radio.svelte'
  import Select from '$lib/shared/components/Select.svelte'
  import { InputCheck, InputColor, InputText } from '$lib/shared/components'
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getAllAois, getHiddenAois } from '$lib/data/engine'
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
    userSelected?: string
    source: string
  }

  let {
    selectedStimulus = $bindable('0'),
    userSelected = $bindable('this'),
    source,
  }: Props = $props()
  const { engine, modalState, toastState, workspace } = getGazePlotterSession()

  const isValidMatch = (displayedName: string): boolean =>
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined

  const deepCopyAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] =>
    aois.map(aoi => ({
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }))

  const rawAois = getAllAois(engine, parseInt(selectedStimulus))
  let aoiObjects: ExtendedInterpretedDataType[] = $state(deepCopyAois(rawAois))
  let lastSelectedStimulus = $state(selectedStimulus)

  const initialHidden = getHiddenAois(engine, parseInt(selectedStimulus))
  let hiddenAoiIds: number[] = $state([...initialHidden])
  let lastHiddenSnapshot = $state([...initialHidden])
  const hiddenSet = $derived(new Set(hiddenAoiIds))

  $effect(() => {
    if (selectedStimulus !== lastSelectedStimulus) {
      const rawAois = getAllAois(engine, parseInt(selectedStimulus))
      aoiObjects = deepCopyAois(rawAois)
      lastSelectedStimulus = selectedStimulus

      const nextHidden = getHiddenAois(engine, parseInt(selectedStimulus))
      hiddenAoiIds = [...nextHidden]
      lastHiddenSnapshot = [...nextHidden]
    }
  })

  // --- Grouping logic ---

  interface AoiGroup {
    key: number
    members: ExtendedInterpretedDataType[]
  }

  const groupedAois = $derived.by<AoiGroup[]>(() => {
    const seen = new Set<string>()
    const groups: AoiGroup[] = []

    for (const aoi of aoiObjects) {
      const trimmed = (aoi.displayedName || '').trim()
      if (!isValidMatch(trimmed)) {
        groups.push({ key: aoi.id, members: [aoi] })
        continue
      }
      if (seen.has(trimmed)) continue
      seen.add(trimmed)
      const members = aoiObjects.filter(
        a => (a.displayedName || '').trim() === trimmed
      )
      groups.push({ key: members[0].id, members })
    }

    return groups
  })

  const hasGroups = $derived(groupedAois.some(g => g.members.length > 1))

  // --- No AOI treatment ---

  const modificationMeta = engine.metadata
  if (!modificationMeta) throw new Error('Data engine metadata not available')

  let noAoiTreatment = $state({
    displayedName: modificationMeta.noAoiTreatment.displayedName,
    color: modificationMeta.noAoiTreatment.color,
  })
  let lastNoAoiTreatmentSnapshot = $state({
    displayedName: modificationMeta.noAoiTreatment.displayedName,
    color: modificationMeta.noAoiTreatment.color,
  })

  // --- Name editing ---

  const handleNameInput = (
    aoi: ExtendedInterpretedDataType,
    newName: string,
    isLeader: boolean,
    group: AoiGroup
  ) => {
    if (isLeader && group.members.length > 1) {
      // Leader rename — propagate to all group members
      const memberIds = new Set(group.members.map(m => m.id))
      for (const a of aoiObjects) {
        if (memberIds.has(a.id)) {
          a.displayedName = newName
        }
      }
    } else {
      // Single AOI rename (ungrouped or non-leader detaching)
      const originalAoi = aoiObjects.find(a => a.id === aoi.id)
      if (originalAoi) {
        originalAoi.displayedName = newName
      }

      // Sync visibility when joining a group
      const trimmedName = (newName || '').trim()
      if (isValidMatch(trimmedName)) {
        const groupMember = aoiObjects.find(
          a =>
            a.id !== aoi.id &&
            (a.displayedName || '').trim() === trimmedName
        )
        if (groupMember) {
          const isGroupHidden = hiddenAoiIds.includes(groupMember.id)
          if (isGroupHidden) {
            if (!hiddenAoiIds.includes(aoi.id)) {
              hiddenAoiIds = [...hiddenAoiIds, aoi.id]
            }
          } else {
            hiddenAoiIds = hiddenAoiIds.filter(id => id !== aoi.id)
          }
        }
      }
    }
  }

  // --- Visibility toggle ---

  const toggleActive = (group: AoiGroup, active: boolean) => {
    const affectedIds = group.members.map(a => a.id)
    if (active) {
      hiddenAoiIds = hiddenAoiIds.filter(id => !affectedIds.includes(id))
    } else {
      hiddenAoiIds = Array.from(new Set([...hiddenAoiIds, ...affectedIds]))
    }
  }

  // --- Color change ---

  const handleColorInput = (group: AoiGroup, newColor: string) => {
    const leaderId = group.members[0].id
    aoiObjects = aoiObjects.map(a =>
      a.id === leaderId ? { ...a, color: newColor } : a
    )
  }

  // --- Drag reorder ---

  let dragGroupKey: number | null = $state(null)

  const dragHandle = createDragReorder({
    itemSelector: '.aoi-card',
    containerSelector: '.aoi-grid',
    onDragStart: key => {
      dragGroupKey = key
    },
    onDragEnd: () => {
      dragGroupKey = null
    },
    onReorder: (fromIndex, toIndex) => {
      const current = groupedAois
      const dragged = current[fromIndex]
      const without = current.filter((_, i) => i !== fromIndex)
      without.splice(toIndex, 0, dragged)

      const newOrder: ExtendedInterpretedDataType[] = []
      for (const g of without) {
        for (const m of g.members) {
          newOrder.push(aoiObjects.find(a => a.id === m.id)!)
        }
      }
      aoiObjects = newOrder
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

  const sortAois = (
    column: 'originalName' | 'displayedName',
    direction: 'asc' | 'desc'
  ) => {
    aoiObjects = [...aoiObjects].sort((a, b) => {
      const cmp = naturalSort(a[column], b[column])
      return direction === 'asc' ? cmp : -cmp
    })
    showSortMenu = false
  }

  const clickOutsideSort = (node: HTMLElement) => {
    const handleClick = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) {
        showSortMenu = false
      }
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
    const handlerTypeMap = {
      this: 'this_stimulus',
      all_original: 'all_by_original_name',
      all_displayed: 'all_by_displayed_name',
    } as const

    const handlerType =
      handlerTypeMap[userSelected as keyof typeof handlerTypeMap]

    const cleanedAois = aoiObjects.map(aoi => ({
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: (aoi.displayedName || '').trim(),
      color: aoi.color,
    }))

    const stimulusId = parseInt(selectedStimulus)

    const hiddenUniqueSorted = Array.from(
      new Set(hiddenAoiIds.filter(v => Number.isInteger(v) && v >= 0))
    ).sort((a, b) => a - b)

    if (
      !workspace.updateAois(
        cleanedAois,
        stimulusId,
        handlerType,
        source,
        hiddenUniqueSorted
      )
    ) {
      return
    }

    if (
      noAoiTreatment.displayedName !==
        lastNoAoiTreatmentSnapshot.displayedName ||
      noAoiTreatment.color !== lastNoAoiTreatmentSnapshot.color
    ) {
      const didUpdateNoAoiTreatment = workspace.updateNoAoiTreatment(
        {
          displayedName: (noAoiTreatment.displayedName || 'No AOI').trim(),
          color: noAoiTreatment.color,
        },
        source
      )

      if (!didUpdateNoAoiTreatment) {
        return
      }

      lastNoAoiTreatmentSnapshot = {
        displayedName: noAoiTreatment.displayedName,
        color: noAoiTreatment.color,
      }
    }

    lastHiddenSnapshot = [...hiddenUniqueSorted]

    if (handlerType !== 'this_stimulus') {
      toastState.addInfo('Ordering of AOIs is not updated for other stimuli')
    }

    modalState.close()
  }

  const handleCancel = () => {
    modalState.close()
  }

  const stimuliOption = getStimuliOptions(engine)
</script>

<div class="stimulus-row">
  <Select
    label="For stimulus"
    options={stimuliOption}
    bind:value={selectedStimulus}
  />
</div>

<Section>
  <div class="section-title-row">
    <span class="section-title">AOIs</span>
    {#if groupedAois.length > 0}
      <div class="sort-wrapper" use:clickOutsideSort>
        <button
          class="tool-button"
          class:active={showSortMenu}
          onclick={() => { showSortMenu = !showSortMenu }}
          aria-label="Sort AOIs"
          use:tooltipAction={{ content: 'Sort', position: 'bottom', disabled: showSortMenu }}
        >
          <ArrowDownAZ size={'1em'} />
        </button>
        {#if showSortMenu}
          <div class="sort-menu">
            <button class="sort-option" onclick={() => sortAois('originalName', 'asc')}>Original name A–Z</button>
            <button class="sort-option" onclick={() => sortAois('originalName', 'desc')}>Original name Z–A</button>
            <button class="sort-option" onclick={() => sortAois('displayedName', 'asc')}>Displayed name A–Z</button>
            <button class="sort-option" onclick={() => sortAois('displayedName', 'desc')}>Displayed name Z–A</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if groupedAois.length === 0}
    <Empty message="No AOIs found in stimulus" />
  {:else}
    <div class="aoi-grid">
      <div class="aoi-column-labels">
        <span>Move</span>
        <span>Original</span>
        <span>Displayed</span>
        <span>Color</span>
        <span>Visible</span>
      </div>
      {#each groupedAois as group (group.key)}
        {@const isActive = !hiddenSet.has(group.members[0].id)}
        <div
          class="aoi-card"
          class:dragging={dragGroupKey === group.key}
          data-group-key={group.key}
          animate:flip={{ duration: 200 }}
        >
          {#each group.members as aoi, i (aoi.id)}
            {@const isLeader = i === 0}
            <div
              class="aoi-row"
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
              <div class="col-original">{aoi.originalName}</div>
              <div class="col-displayed">
                <InputText
                  label="Displayed name"
                  showLabel={false}
                  fill={true}
                  disabled={!isActive}
                  ariaLabel={`Displayed name for ${aoi.originalName}`}
                  value={aoi.displayedName}
                  oninput={e =>
                    handleNameInput(aoi, e.detail, isLeader, group)
                  }
                />
              </div>
              <div class="col-color">
                {#if isLeader}
                  <div class:disabled-control={!isActive}>
                    <InputColor
                      label="Color"
                      showLabel={false}
                      width={35}
                      ariaLabel={`Color for ${aoi.originalName}`}
                      value={aoi.color}
                      oninput={event =>
                        isActive && handleColorInput(group, event.detail)
                      }
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
        <div class="aoi-hint">
          <div class="col-handle">
            <Info size={'1em'} />
          </div>
          <div class="hint-text" style="grid-column: 2 / -1;">Name AOIs the same to <strong>group</strong> them together</div>
        </div>
      {/if}
    </div>

    <div class="content">
      <Radio
        legend="Apply changes to"
        options={[
          { label: 'This stimulus', value: 'this' },
          { label: 'All by original name', value: 'all_original' },
          { label: 'All by displayed name', value: 'all_displayed' },
        ]}
        bind:value={userSelected}
      />
    </div>
    <div class="content">
      <Section title="No AOI Hit Treatment">
        <div class="noaoi-treatment-container">
          <div class="noaoi-color-wrapper">
            <InputColor label="Color" bind:value={noAoiTreatment.color} />
          </div>
          <div class="noaoi-name-wrapper">
            <InputText
              label="Display name"
              placeholder="No AOI"
              bind:value={noAoiTreatment.displayedName}
              fill={true}
            />
          </div>
        </div>
      </Section>
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
  .stimulus-row {
    margin-bottom: 20px;
  }

  .content {
    margin-bottom: 25px;
  }

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

  .aoi-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(600px, 100%);
    margin-bottom: 20px;
  }

  .aoi-column-labels {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 40px 40px;
    gap: 8px;
    padding: 0 12px;
    font-size: 10px;
    color: var(--c-midgrey);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .aoi-column-labels span:first-child {
    margin-left: -12px;
  }

  .aoi-column-labels span:nth-child(4),
  .aoi-column-labels span:nth-child(5) {
    text-align: center;
  }

  .aoi-hint {
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

  .aoi-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .aoi-card.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .aoi-card.dragging > * {
    visibility: hidden;
  }

  .aoi-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 40px 40px;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--c-darkwhite);
  }

  .aoi-row:not(.leader) {
    border-top: 1px solid var(--c-border);
    background-color: var(--c-white);
  }

  .aoi-row.inactive {
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

  .noaoi-treatment-container {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .noaoi-color-wrapper {
    flex: 0 0 auto;
    min-width: 120px;
  }

  .noaoi-name-wrapper {
    flex: 1;
    max-width: 250px;
  }
</style>
