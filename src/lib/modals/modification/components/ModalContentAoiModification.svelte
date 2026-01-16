<script lang="ts">
  import GeneralRadio from '$lib/shared/components/GeneralRadio.svelte'
  import GeneralSelectBase from '$lib/shared/components/GeneralSelect.svelte'
  import { GeneralInputCheck, GeneralInputColor } from '$lib/shared/components'
  import {
    SortableTableHeader,
    SectionHeader,
    ModalButtons,
    IntroductoryParagraph,
  } from '$lib/modals'
  import { modalStore } from '$lib/modals/shared/stores/modalStore'
  import {
    getAllAois,
    getHiddenAois,
    getData,
  } from '$lib/gaze-data/front-process/stores/dataStore'
  import { addErrorToast, addInfoToast } from '$lib/toaster'
  import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import GeneralPositionControl from '$lib/shared/components/GeneralPositionControl.svelte'
  import GeneralEmpty from '$lib/shared/components/GeneralEmpty.svelte'
  import { getStimuliOptions } from '$lib/plots/shared/utils/sharedPlotUtils'
  import type { WorkspaceCommand } from '$lib/shared/types/workspaceInstructions'

  interface Props {
    selectedStimulus?: string
    userSelected?: string
    source: string
    onWorkspaceCommand: (command: WorkspaceCommand) => void
  }

  let {
    selectedStimulus = $bindable('0'),
    userSelected = $bindable('this'),
    source,
    onWorkspaceCommand,
  }: Props = $props()

  const isValidMatch = (displayedName: string): boolean =>
    typeof displayedName === 'string' &&
    displayedName.trim() !== '' &&
    displayedName !== undefined

  const reorderAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] => {
    const processed = new Set<number>()
    const result: ExtendedInterpretedDataType[] = []

    // Go through AOIs in order, grouping only valid names
    for (let i = 0; i < aois.length; i++) {
      if (processed.has(i)) continue

      const aoi = aois[i]
      const trimmedName = (aoi.displayedName || '').trim()

      // If empty or invalid name, keep in place
      if (!isValidMatch(trimmedName)) {
        result.push(aoi)
        processed.add(i)
        continue
      }

      // Find all AOIs with the same trimmed name
      const group: ExtendedInterpretedDataType[] = []
      for (let j = i; j < aois.length; j++) {
        if (processed.has(j)) continue
        const otherTrimmed = (aois[j].displayedName || '').trim()
        if (otherTrimmed === trimmedName) {
          group.push(aois[j])
          processed.add(j)
        }
      }

      // Do not hard-set color, plots will correctly use the color of the first AOI in the group
      group.forEach(g => result.push(g))
    }

    return result
  }

  const moveItem = (
    aois: ExtendedInterpretedDataType[],
    aoi: ExtendedInterpretedDataType,
    direction: 'up' | 'down'
  ): ExtendedInterpretedDataType[] => {
    const trimmedName = (aoi.displayedName || '').trim()
    const groupedAois = isValidMatch(trimmedName)
      ? aois.filter(a => (a.displayedName || '').trim() === trimmedName)
      : [aoi]

    const firstGroupIndex = aois.indexOf(groupedAois[0])
    const currentIndex = aois.indexOf(aoi)

    if (direction === 'up' && currentIndex > 0) {
      if (groupedAois.length === 1) {
        const prevItemIndex = currentIndex - 1
        const prevItemDisplayedName = (
          aois[prevItemIndex].displayedName || ''
        ).trim()

        if (isValidMatch(prevItemDisplayedName)) {
          const prevGroup = aois.filter(
            (a, i) =>
              i < currentIndex &&
              (a.displayedName || '').trim() === prevItemDisplayedName
          )
          const prevGroupStart = aois.indexOf(prevGroup[0])

          return [
            ...aois.slice(0, prevGroupStart),
            aoi,
            ...aois.slice(prevGroupStart, currentIndex),
            ...aois.slice(currentIndex + 1),
          ]
        }

        return [
          ...aois.slice(0, currentIndex - 1),
          aois[currentIndex],
          aois[currentIndex - 1],
          ...aois.slice(currentIndex + 1),
        ]
      } else if (firstGroupIndex > 0) {
        const prevItem = aois[firstGroupIndex - 1]
        const prevItemTrimmed = (prevItem.displayedName || '').trim()
        const prevGroup = isValidMatch(prevItemTrimmed)
          ? aois.filter(a => (a.displayedName || '').trim() === prevItemTrimmed)
          : [prevItem]
        const prevGroupStart = aois.indexOf(prevGroup[0])

        return [
          ...aois.slice(0, prevGroupStart),
          ...groupedAois,
          ...prevGroup,
          ...aois.slice(firstGroupIndex + groupedAois.length),
        ]
      }
    }

    if (direction === 'down' && currentIndex < aois.length - 1) {
      if (groupedAois.length === 1) {
        return [
          ...aois.slice(0, currentIndex),
          aois[currentIndex + 1],
          aois[currentIndex],
          ...aois.slice(currentIndex + 2),
        ]
      } else if (firstGroupIndex < aois.length - groupedAois.length) {
        const beforeGroup = aois.slice(0, firstGroupIndex)
        const afterGroup = aois.slice(firstGroupIndex + groupedAois.length + 1)
        const swapItem = aois[firstGroupIndex + groupedAois.length]
        return [...beforeGroup, swapItem, ...groupedAois, ...afterGroup]
      }
    }

    return aois
  }

  const deepCopyAois = (
    aois: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] =>
    aois.map(aoi => ({
      id: aoi.id,
      originalName: aoi.originalName,
      displayedName: aoi.displayedName,
      color: aoi.color,
    }))

  const rawAois = getAllAois(parseInt(selectedStimulus))
  let aoiObjects: ExtendedInterpretedDataType[] = $state(deepCopyAois(rawAois))
  let lastSelectedStimulus = $state(selectedStimulus)

  const initialHidden = getHiddenAois(parseInt(selectedStimulus))
  let hiddenAoiIds: number[] = $state([...initialHidden])
  let lastHiddenSnapshot = $state([...initialHidden])
  const hiddenSet = $derived(new Set(hiddenAoiIds))

  $effect(() => {
    if (selectedStimulus !== lastSelectedStimulus) {
      const rawAois = getAllAois(parseInt(selectedStimulus))
      aoiObjects = deepCopyAois(rawAois)
      lastSelectedStimulus = selectedStimulus

      const nextHidden = getHiddenAois(parseInt(selectedStimulus))
      hiddenAoiIds = [...nextHidden]
      lastHiddenSnapshot = [...nextHidden]
    }
  })

  // Use $derived to compute reordered AOIs reactively without mutation
  // This prevents race conditions during rapid input changes
  const reorderedAoiObjects = $derived(reorderAois([...aoiObjects]))

  // Get initial No AOI treatment and track changes
  const data = getData()
  let noAoiTreatment = $state({
    displayedName: data.noAoiTreatment.displayedName,
    color: data.noAoiTreatment.color,
  })
  let lastNoAoiTreatmentSnapshot = $state({
    displayedName: data.noAoiTreatment.displayedName,
    color: data.noAoiTreatment.color,
  })

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

  // Natural sort function for alphanumeric strings
  const naturalSort = (a: string, b: string): number => {
    const aParts = a.match(/(\d+|\D+)/g) || []
    const bParts = b.match(/(\d+|\D+)/g) || []

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      const aPart = aParts[i]
      const bPart = bParts[i]

      if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
        const numA = parseInt(aPart, 10)
        const numB = parseInt(bPart, 10)
        if (numA !== numB) return numA - numB
      } else {
        const strCompare = aPart.localeCompare(bPart)
        if (strCompare !== 0) return strCompare
      }
    }

    return aParts.length - bParts.length
  }

  const handleSort = (params: {
    column: 'originalName' | 'displayedName'
    newSortDirection: 'asc' | 'desc'
  }) => {
    sortColumn = params.column
    sortDirection = params.newSortDirection

    aoiObjects = [...aoiObjects].sort((a, b) => {
      const compare = naturalSort(a[params.column], b[params.column])
      return params.newSortDirection === 'asc' ? compare : -compare
    })
  }

  const handleObjectPositionUp = (aoi: ExtendedInterpretedDataType) => {
    // Work on the already-reordered array where groups are contiguous
    const reordered = reorderAois([...aoiObjects])
    const movedAoi = reordered.find(a => a.id === aoi.id)
    if (movedAoi) {
      const result = moveItem(reordered, movedAoi, 'up')
      // Map back to original aoiObjects by ID, preserving the untrimmed displayedName
      aoiObjects = result.map(r => {
        const original = aoiObjects.find(o => o.id === r.id)!
        return { ...original, color: r.color }
      })
    }
    sortColumn = null
    sortDirection = null
  }

  const handleObjectPositionDown = (aoi: ExtendedInterpretedDataType) => {
    // Work on the already-reordered array where groups are contiguous
    const reordered = reorderAois([...aoiObjects])
    const movedAoi = reordered.find(a => a.id === aoi.id)
    if (movedAoi) {
      const result = moveItem(reordered, movedAoi, 'down')
      // Map back to original aoiObjects by ID, preserving the untrimmed displayedName
      aoiObjects = result.map(r => {
        const original = aoiObjects.find(o => o.id === r.id)!
        return { ...original, color: r.color }
      })
    }
    sortColumn = null
    sortDirection = null
  }

  const handleSubmit = () => {
    const handlerTypeMap = {
      this: 'this_stimulus',
      all_original: 'all_by_original_name',
      all_displayed: 'all_by_displayed_name',
    } as const

    const handlerType =
      handlerTypeMap[userSelected as keyof typeof handlerTypeMap]

    try {
      // Trim all displayedName values before submitting to prevent empty strings
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

      onWorkspaceCommand({
        type: 'updateAois',
        aois: cleanedAois,
        source,
        stimulusId,
        applyTo: handlerType,
        hiddenAois: hiddenUniqueSorted,
      })

      // Update No AOI treatment if it changed
      if (
        noAoiTreatment.displayedName !==
          lastNoAoiTreatmentSnapshot.displayedName ||
        noAoiTreatment.color !== lastNoAoiTreatmentSnapshot.color
      ) {
        onWorkspaceCommand({
          type: 'updateNoAoiTreatment',
          noAoiTreatment: {
            displayedName: (noAoiTreatment.displayedName || 'No AOI').trim(),
            color: noAoiTreatment.color,
          },
          source,
        })

        lastNoAoiTreatmentSnapshot = {
          displayedName: noAoiTreatment.displayedName,
          color: noAoiTreatment.color,
        }
      }

      // snapshot for undo baseline
      lastHiddenSnapshot = [...hiddenUniqueSorted]

      if (handlerType !== 'this_stimulus') {
        addInfoToast('Ordering of AOIs is not updated for other stimuli')
      }

      modalStore.close()
    } catch (e) {
      console.error(e)
      addErrorToast('Error while updating AOIs. See console for more details.')
    }
  }

  const handleCancel = () => {
    modalStore.close()
  }

  const stimuliOption = getStimuliOptions()
</script>

<div class="content">
  <IntroductoryParagraph
    maxWidth="440px"
    paragraphs={[
      'Modify AOI names, colors, and grouping. Each stimulus has its own AOI list.',
      '**To create groups**, give multiple AOIs the same displayed name. The color of the first AOI with each name will be used for the entire group.',
    ]}
  />
  <GeneralSelectBase
    label="For stimulus"
    options={stimuliOption}
    bind:value={selectedStimulus}
  />
</div>

<SectionHeader text="AOIs" />
{#if reorderedAoiObjects.length === 0}
  <GeneralEmpty message="No AOIs found in stimulus" />
{/if}
{#if reorderedAoiObjects.length > 0}
  <table class="grid content">
    <thead>
      <tr class="gr-line header">
        <th>
          <SortableTableHeader
            column="originalName"
            label="Name"
            {sortColumn}
            {sortDirection}
            onSort={handleSort}
          />
        </th>
        <th>
          <SortableTableHeader
            column="displayedName"
            label="Displayed name"
            {sortColumn}
            {sortDirection}
            onSort={handleSort}
          />
        </th>
        <th>Color</th>
        <th>Order</th>
        <th>Is active</th>
      </tr>
    </thead>
    <tbody>
      {#each reorderedAoiObjects as aoi (aoi.id + selectedStimulus)}
        {@const showGroupControls =
          !isValidMatch((aoi.displayedName || '').trim()) ||
          reorderedAoiObjects.findIndex(
            a =>
              isValidMatch((a.displayedName || '').trim()) &&
              (a.displayedName || '').trim() ===
                (aoi.displayedName || '').trim()
          ) === reorderedAoiObjects.indexOf(aoi)}
        {@const isActive = !hiddenSet.has(aoi.id)}
        <tr
          class="gr-line"
          animate:flip={{ duration: 250 }}
          in:fade={{ duration: 200 }}
        >
          <td class="original-name">{aoi.originalName}</td>
          <td>
            <input
              type="text"
              id={aoi.id + 'displayedName'}
              value={aoi.displayedName}
              disabled={!isActive}
              oninput={e => {
                const target = e.currentTarget
                // Find and update the original AOI in aoiObjects
                const originalAoi = aoiObjects.find(a => a.id === aoi.id)
                if (originalAoi) {
                  originalAoi.displayedName = target.value
                }
              }}
            />
          </td>
          {#if showGroupControls}
            <td class="color-cell">
              <div class:disabled-control={!isActive} aria-disabled={!isActive}>
                <GeneralInputColor
                  label=""
                  value={aoi.color}
                  oninput={event => {
                    if (!isActive) return
                    const aoiId = aoi.id
                    const index = aoiObjects.findIndex(a => a.id === aoiId)
                    if (index !== -1) {
                      aoiObjects = aoiObjects.map((a, i) =>
                        i === index ? { ...a, color: event.detail } : a
                      )
                    }
                  }}
                />
              </div>
            </td>
            <td>
              <div
                class="button-group"
                class:disabled-control={!isActive}
                aria-disabled={!isActive}
              >
                <GeneralPositionControl
                  isFirst={(() => {
                    if (!isActive) return true
                    const trimmedName = (aoi.displayedName || '').trim()
                    if (isValidMatch(trimmedName)) {
                      let firstGroupIndex = reorderedAoiObjects.length
                      reorderedAoiObjects.forEach((a, idx) => {
                        const otherTrimmed = (a.displayedName || '').trim()
                        if (otherTrimmed === trimmedName) {
                          firstGroupIndex = Math.min(firstGroupIndex, idx)
                        }
                      })
                      return firstGroupIndex === 0
                    }
                    return reorderedAoiObjects.indexOf(aoi) === 0
                  })()}
                  isLast={(() => {
                    if (!isActive) return true
                    const trimmedName = (aoi.displayedName || '').trim()
                    if (isValidMatch(trimmedName)) {
                      let lastGroupIndex = -1
                      reorderedAoiObjects.forEach((a, idx) => {
                        const otherTrimmed = (a.displayedName || '').trim()
                        if (otherTrimmed === trimmedName) {
                          lastGroupIndex = Math.max(lastGroupIndex, idx)
                        }
                      })
                      return lastGroupIndex === reorderedAoiObjects.length - 1
                    }
                    return (
                      reorderedAoiObjects.indexOf(aoi) ===
                      reorderedAoiObjects.length - 1
                    )
                  })()}
                  onMoveDown={() => {
                    if (!isActive) return
                    handleObjectPositionDown(aoi)
                  }}
                  onMoveUp={() => {
                    if (!isActive) return
                    handleObjectPositionUp(aoi)
                  }}
                />
              </div>
            </td>
          {:else}
            <td colspan="2" class="group-info"
              >change name to detach from group</td
            >
          {/if}

          <td class="active-col">
            <GeneralInputCheck
              label=""
              ariaLabel="Is active"
              size="lg"
              checked={isActive}
              onchange={e => {
                const active = e.detail
                if (active) {
                  hiddenAoiIds = hiddenAoiIds.filter(id => id !== aoi.id)
                } else {
                  hiddenAoiIds = Array.from(new Set([...hiddenAoiIds, aoi.id]))
                }
              }}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="content">
    <GeneralRadio
      legend="Apply changes to"
      options={[
        { label: 'This stimulus', value: 'this' },
        { label: 'All by original name', value: 'all_original' },
        { label: 'All by displayed name', value: 'all_displayed' },
      ]}
      bind:userSelected
    />
  </div>
  <div class="content">
    <SectionHeader text="No AOI Hit Treatment" />
    <div class="noaoi-treatment-container">
      <div class="noaoi-color-wrapper">
        <GeneralInputColor label="Color" bind:value={noAoiTreatment.color} />
      </div>
      <div class="noaoi-name-wrapper">
        <label for="noaoi-display-name">Display name</label>
        <input
          id="noaoi-display-name"
          type="text"
          placeholder="No AOI"
          bind:value={noAoiTreatment.displayedName}
          class="noaoi-name-input"
        />
      </div>
    </div>
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

<style>
  /* Component Group */
  input {
    height: 34px;
    box-sizing: border-box;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    margin: 0;
    padding: 0.5rem;
  }

  .active-col {
    text-align: center;
    vertical-align: middle;
    width: 80px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .disabled-control {
    opacity: 0.45;
    pointer-events: none;
    filter: grayscale(0.2);
  }

  .color-cell {
    padding: 0;
  }

  .color-cell :global(.input) {
    margin-bottom: 0;
  }

  .color-cell :global(label) {
    display: none;
  }

  .button-group {
    display: flex;
    gap: 3px;
    flex-direction: row;
  }

  th {
    text-align: left;
    font-size: 14px;
  }
  .original-name {
    font-size: 14px;
    padding-right: 10px;
    color: var(--c-midgrey);
    cursor: not-allowed;
  }
  .content {
    margin-bottom: 25px;
  }
  .original-name {
    line-height: 1;
    white-space: nowrap;
  }
  .group-info {
    font-size: 12px;
    color: var(--c-midgrey);
    font-style: italic;
    width: 90px;
    line-height: 1.1;
    border: 1px solid var(--c-midgrey);
    border-radius: 5px;
    padding: 3px 7px;
  }

  .noaoi-name-input {
    width: 100%;
    padding: 0.5rem;
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

  .noaoi-name-wrapper label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--c-text);
    margin-bottom: 6px;
  }

  .noaoi-name-wrapper input {
    width: 100%;
    height: 34px;
    box-sizing: border-box;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded);
    padding: 0.5rem;
    font-size: 14px;
  }

  .noaoi-name-wrapper input:focus {
    outline: none;
    border-color: var(--c-primary);
    box-shadow: 0 0 0 2px rgba(var(--rgb-primary), 0.1);
  }
</style>
