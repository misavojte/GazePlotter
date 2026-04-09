<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getAllParticipants } from '$lib/data/engine'
  import { getGazePlotterSession } from '$lib/session'
  import type { BaseInterpretedDataType } from '$lib/data/types'
  import { flip } from 'svelte/animate'
  import Empty from '$lib/shared/components/Empty.svelte'
  import PatternRenamingTool from '../shared/PatternRenamingTool.svelte'
  import { InputText } from '$lib/shared/components'
  import GripVertical from 'lucide-svelte/icons/grip-vertical'
  import ArrowDownAZ from 'lucide-svelte/icons/arrow-down-a-z'
  import Replace from 'lucide-svelte/icons/replace'
  import { createDragReorder } from '../shared/dragReorder'
  import { tooltipAction } from '$lib/tooltip'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { modalState, workspace, engine } = getGazePlotterSession()

  const deepCopyParticipants = (
    participants: BaseInterpretedDataType[]
  ): BaseInterpretedDataType[] =>
    participants.map(participant => ({
      id: participant.id,
      originalName: participant.originalName,
      displayedName: participant.displayedName,
    }))

  const rawParticipants = getAllParticipants(engine)
  let participantObjects: BaseInterpretedDataType[] = $state(
    deepCopyParticipants(rawParticipants)
  )

  const handlePatternRename = (findText: string, replaceText: string) => {
    participantObjects = participantObjects.map(participant => ({
      ...participant,
      displayedName: participant.displayedName.replace(
        new RegExp(findText, 'g'),
        replaceText
      ),
    }))
  }

  const handleSubmit = () => {
    const participantObjectsCopy = deepCopyParticipants(participantObjects)
    if (workspace.updateParticipants(participantObjectsCopy, source)) {
      modalState.close()
    }
  }

  const handleCancel = () => {
    modalState.close()
  }

  // --- Pattern rename panel ---

  let showRenamePanel = $state(false)

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

  const sortParticipants = (
    column: 'originalName' | 'displayedName',
    direction: 'asc' | 'desc'
  ) => {
    participantObjects = [...participantObjects].sort((a, b) => {
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

  const clickOutsideRename = (node: HTMLElement) => {
    const handleClick = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) showRenamePanel = false
    }
    document.addEventListener('click', handleClick, true)
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true)
      },
    }
  }

  // --- Drag reorder ---

  let dragItemKey: number | null = $state(null)

  const dragHandle = createDragReorder({
    itemSelector: '.participant-card',
    containerSelector: '.participant-grid',
    onDragStart: key => {
      dragItemKey = key
    },
    onDragEnd: () => {
      dragItemKey = null
    },
    onReorder: (fromIndex, toIndex) => {
      const arr = [...participantObjects]
      const [removed] = arr.splice(fromIndex, 1)
      arr.splice(toIndex, 0, removed)
      participantObjects = arr
    },
  })
</script>

<Section>
  <div class="section-title-row">
    <span class="section-title">Participants</span>
    {#if participantObjects.length > 0}
      <div class="title-actions">
        <div class="rename-wrapper" use:clickOutsideRename>
          <button
            class="tool-button"
            class:active={showRenamePanel}
            onclick={() => { showRenamePanel = !showRenamePanel; showSortMenu = false }}
            aria-label="Bulk rename"
            use:tooltipAction={{ content: 'Bulk rename', position: 'bottom', disabled: showRenamePanel }}
          >
            <Replace size={'1em'} />
          </button>
          {#if showRenamePanel}
            <div class="rename-dropdown">
              <PatternRenamingTool
                onRenameCommand={(findText, replaceText) => {
                  handlePatternRename(findText, replaceText)
                  showRenamePanel = false
                }}
              />
            </div>
          {/if}
        </div>
        <div class="sort-wrapper" use:clickOutsideSort>
          <button
            class="tool-button"
            class:active={showSortMenu}
            onclick={() => { showSortMenu = !showSortMenu; showRenamePanel = false }}
            aria-label="Sort participants"
            use:tooltipAction={{ content: 'Sort', position: 'bottom', disabled: showSortMenu }}
          >
            <ArrowDownAZ size={'1em'} />
          </button>
          {#if showSortMenu}
            <div class="sort-menu">
              <button class="sort-option" onclick={() => sortParticipants('originalName', 'asc')}>Original name A–Z</button>
              <button class="sort-option" onclick={() => sortParticipants('originalName', 'desc')}>Original name Z–A</button>
              <button class="sort-option" onclick={() => sortParticipants('displayedName', 'asc')}>Displayed name A–Z</button>
              <button class="sort-option" onclick={() => sortParticipants('displayedName', 'desc')}>Displayed name Z–A</button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if participantObjects.length === 0}
    <Empty message="No participants found" />
  {:else}
    <div class="participant-grid">
      <div class="participant-column-labels">
        <span>Move</span>
        <span>Original</span>
        <span>Displayed</span>
      </div>
      {#each participantObjects as participant (participant.id)}
        <div
          class="participant-card"
          class:dragging={dragItemKey === participant.id}
          animate:flip={{ duration: 200 }}
        >
          <div class="participant-row">
            <div class="col-handle">
              <div class="drag-handle" use:dragHandle={participant.id}>
                <GripVertical size={'1em'} />
              </div>
            </div>
            <div class="col-original">{participant.originalName}</div>
            <div class="col-displayed">
              <InputText
                label="Displayed name"
                showLabel={false}
                fill={true}
                ariaLabel={`Displayed name for ${participant.originalName}`}
                value={participant.displayedName}
                oninput={e => {
                  const participantId = participant.id
                  const index = participantObjects.findIndex(
                    p => p.id === participantId
                  )
                  if (index !== -1) {
                    participantObjects = participantObjects.map((p, i) =>
                      i === index ? { ...p, displayedName: e.detail } : p
                    )
                  }
                }}
              />
            </div>
          </div>
        </div>
      {/each}
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

  .rename-wrapper {
    position: relative;
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

  .participant-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(600px, 100%);
    margin-bottom: 20px;
  }

  .participant-column-labels {
    display: grid;
    grid-template-columns: 28px 1fr 1fr;
    gap: 8px;
    padding: 0 12px;
    font-size: 10px;
    color: var(--c-midgrey);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .participant-column-labels span:first-child {
    margin-left: -12px;
  }

  .participant-card {
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  }

  .participant-card.dragging {
    opacity: 0.3;
    border-style: dashed;
    border-color: var(--c-midgrey);
    box-shadow: none;
  }

  .participant-card.dragging > * {
    visibility: hidden;
  }

  .participant-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--c-darkwhite);
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
</style>
