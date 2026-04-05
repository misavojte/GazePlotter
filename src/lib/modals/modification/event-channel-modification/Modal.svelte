<script lang="ts">
  import Select from '$lib/shared/components/Select.svelte'
  import { InputCheck, InputColor, InputText } from '$lib/shared/components'
  import {
    SortableTableHeader,
    Section,
    ModalButtons,
    IntroductoryParagraph,
  } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getEventChannels, getHiddenEventChannels } from '$lib/data/engine'
  import type { ExtendedInterpretedDataType } from '$lib/data/types'
  import { flip } from 'svelte/animate'
  import { fade } from 'svelte/transition'
  import Empty from '$lib/shared/components/Empty.svelte'
  import { getStimuliOptions } from '$lib/plots/shared'
  import ReorderButtons from '../shared/ReorderButtons.svelte'

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

  const reorderChannels = (
    channels: ExtendedInterpretedDataType[]
  ): ExtendedInterpretedDataType[] => {
    const processed = new Set<number>()
    const result: ExtendedInterpretedDataType[] = []

    for (let i = 0; i < channels.length; i++) {
      if (processed.has(i)) continue

      const channel = channels[i]
      const trimmedName = (channel.displayedName || '').trim()

      if (!isValidMatch(trimmedName)) {
        result.push(channel)
        processed.add(i)
        continue
      }

      const group: ExtendedInterpretedDataType[] = []
      for (let j = i; j < channels.length; j++) {
        if (processed.has(j)) continue
        const otherTrimmed = (channels[j].displayedName || '').trim()
        if (otherTrimmed === trimmedName) {
          group.push(channels[j])
          processed.add(j)
        }
      }

      group.forEach(g => result.push(g))
    }

    return result
  }

  const moveItem = (
    channels: ExtendedInterpretedDataType[],
    channel: ExtendedInterpretedDataType,
    direction: 'up' | 'down'
  ): ExtendedInterpretedDataType[] => {
    const trimmedName = (channel.displayedName || '').trim()
    const groupedChannels = isValidMatch(trimmedName)
      ? channels.filter(c => (c.displayedName || '').trim() === trimmedName)
      : [channel]

    const firstGroupIndex = channels.indexOf(groupedChannels[0])
    const currentIndex = channels.indexOf(channel)

    if (direction === 'up' && currentIndex > 0) {
      if (groupedChannels.length === 1) {
        const prevItemIndex = currentIndex - 1
        const prevItemDisplayedName = (
          channels[prevItemIndex].displayedName || ''
        ).trim()

        if (isValidMatch(prevItemDisplayedName)) {
          const prevGroup = channels.filter(
            (c, i) =>
              i < currentIndex &&
              (c.displayedName || '').trim() === prevItemDisplayedName
          )
          const prevGroupStart = channels.indexOf(prevGroup[0])

          return [
            ...channels.slice(0, prevGroupStart),
            channel,
            ...channels.slice(prevGroupStart, currentIndex),
            ...channels.slice(currentIndex + 1),
          ]
        }

        return [
          ...channels.slice(0, currentIndex - 1),
          channels[currentIndex],
          channels[currentIndex - 1],
          ...channels.slice(currentIndex + 1),
        ]
      } else if (firstGroupIndex > 0) {
        const prevItem = channels[firstGroupIndex - 1]
        const prevItemTrimmed = (prevItem.displayedName || '').trim()
        const prevGroup = isValidMatch(prevItemTrimmed)
          ? channels.filter(c => (c.displayedName || '').trim() === prevItemTrimmed)
          : [prevItem]
        const prevGroupStart = channels.indexOf(prevGroup[0])

        return [
          ...channels.slice(0, prevGroupStart),
          ...groupedChannels,
          ...prevGroup,
          ...channels.slice(firstGroupIndex + groupedChannels.length),
        ]
      }
    }

    if (direction === 'down' && currentIndex < channels.length - 1) {
      if (groupedChannels.length === 1) {
        return [
          ...channels.slice(0, currentIndex),
          channels[currentIndex + 1],
          channels[currentIndex],
          ...channels.slice(currentIndex + 2),
        ]
      } else if (firstGroupIndex < channels.length - groupedChannels.length) {
        const beforeGroup = channels.slice(0, firstGroupIndex)
        const afterGroup = channels.slice(firstGroupIndex + groupedChannels.length + 1)
        const swapItem = channels[firstGroupIndex + groupedChannels.length]
        return [...beforeGroup, swapItem, ...groupedChannels, ...afterGroup]
      }
    }

    return channels
  }

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

  const reorderedChannelObjects = $derived(reorderChannels([...channelObjects]))

  // Sorting state
  let sortColumn = $state<'originalName' | 'displayedName' | null>(null)
  let sortDirection = $state<'asc' | 'desc' | null>(null)

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

    channelObjects = [...channelObjects].sort((a, b) => {
      const compare = naturalSort(a[params.column], b[params.column])
      return params.newSortDirection === 'asc' ? compare : -compare
    })
  }

  const handleObjectPositionUp = (channel: ExtendedInterpretedDataType) => {
    const reordered = reorderChannels([...channelObjects])
    const movedChannel = reordered.find(c => c.id === channel.id)
    if (movedChannel) {
      const result = moveItem(reordered, movedChannel, 'up')
      channelObjects = result.map(r => {
        const original = channelObjects.find(o => o.id === r.id)!
        return { ...original, color: r.color }
      })
    }
    sortColumn = null
    sortDirection = null
  }

  const handleObjectPositionDown = (channel: ExtendedInterpretedDataType) => {
    const reordered = reorderChannels([...channelObjects])
    const movedChannel = reordered.find(c => c.id === channel.id)
    if (movedChannel) {
      const result = moveItem(reordered, movedChannel, 'down')
      channelObjects = result.map(r => {
        const original = channelObjects.find(o => o.id === r.id)!
        return { ...original, color: r.color }
      })
    }
    sortColumn = null
    sortDirection = null
  }

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
  <div class="content">
    <IntroductoryParagraph
      maxWidth="440px"
      paragraphs={[
        'Modify event channel names, colors, and grouping. Each stimulus has its own event channel list.',
        '**To create groups**, give multiple channels the same displayed name. The color of the first channel with each name will be used for the entire group.',
      ]}
    />
    <Select
      label="For stimulus"
      options={stimuliOption}
      bind:value={selectedStimulus}
    />
  </div>
</Section>

<Section title="Event channels">
  {#if reorderedChannelObjects.length === 0}
    <Empty message="No event channels found in stimulus" />
  {/if}
  {#if reorderedChannelObjects.length > 0}
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
        {#each reorderedChannelObjects as channel (channel.id + selectedStimulus)}
          {@const showGroupControls =
            !isValidMatch((channel.displayedName || '').trim()) ||
            reorderedChannelObjects.findIndex(
              c =>
                isValidMatch((c.displayedName || '').trim()) &&
                (c.displayedName || '').trim() ===
                  (channel.displayedName || '').trim()
            ) === reorderedChannelObjects.indexOf(channel)}
          {@const isActive = !hiddenSet.has(channel.id)}
          <tr
            class="gr-line"
            animate:flip={{ duration: 250 }}
            in:fade={{ duration: 200 }}
          >
            <td class="original-name">{channel.originalName}</td>
            <td>
              <InputText
                label="Displayed name"
                showLabel={false}
                fill={true}
                disabled={!isActive}
                ariaLabel={`Displayed name for ${channel.originalName}`}
                value={channel.displayedName}
                oninput={e => {
                  const originalChannel = channelObjects.find(c => c.id === channel.id)
                  if (originalChannel) {
                    originalChannel.displayedName = e.detail

                    const trimmedName = (e.detail || '').trim()
                    if (isValidMatch(trimmedName)) {
                      const groupMember = channelObjects.find(
                        c =>
                          c.id !== channel.id &&
                          (c.displayedName || '').trim() === trimmedName
                      )
                      if (groupMember) {
                        const isGroupHidden = hiddenChannelIds.includes(
                          groupMember.id
                        )
                        if (isGroupHidden) {
                          if (!hiddenChannelIds.includes(channel.id)) {
                            hiddenChannelIds = [...hiddenChannelIds, channel.id]
                          }
                        } else {
                          hiddenChannelIds = hiddenChannelIds.filter(
                            id => id !== channel.id
                          )
                        }
                      }
                    }
                  }
                }}
              />
            </td>
            {#if showGroupControls}
              <td class="color-cell">
                <div
                  class:disabled-control={!isActive}
                  aria-disabled={!isActive}
                >
                  <InputColor
                    label="Color"
                    showLabel={false}
                    ariaLabel={`Color for ${channel.originalName}`}
                    value={channel.color}
                    oninput={event => {
                      if (!isActive) return
                      const index = channelObjects.findIndex(c => c.id === channel.id)
                      if (index !== -1) {
                        channelObjects = channelObjects.map((c, i) =>
                          i === index ? { ...c, color: event.detail } : c
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
                  <ReorderButtons
                    isFirst={(() => {
                      if (!isActive) return true
                      const trimmedName = (channel.displayedName || '').trim()
                      if (isValidMatch(trimmedName)) {
                        let firstGroupIndex = reorderedChannelObjects.length
                        reorderedChannelObjects.forEach((c, idx) => {
                          const otherTrimmed = (c.displayedName || '').trim()
                          if (otherTrimmed === trimmedName) {
                            firstGroupIndex = Math.min(firstGroupIndex, idx)
                          }
                        })
                        return firstGroupIndex === 0
                      }
                      return reorderedChannelObjects.indexOf(channel) === 0
                    })()}
                    isLast={(() => {
                      if (!isActive) return true
                      const trimmedName = (channel.displayedName || '').trim()
                      if (isValidMatch(trimmedName)) {
                        let lastGroupIndex = -1
                        reorderedChannelObjects.forEach((c, idx) => {
                          const otherTrimmed = (c.displayedName || '').trim()
                          if (otherTrimmed === trimmedName) {
                            lastGroupIndex = Math.max(lastGroupIndex, idx)
                          }
                        })
                        return lastGroupIndex === reorderedChannelObjects.length - 1
                      }
                      return (
                        reorderedChannelObjects.indexOf(channel) ===
                        reorderedChannelObjects.length - 1
                      )
                    })()}
                    onMoveDown={() => {
                      if (!isActive) return
                      handleObjectPositionDown(channel)
                    }}
                    onMoveUp={() => {
                      if (!isActive) return
                      handleObjectPositionUp(channel)
                    }}
                  />
                </div>
              </td>
              <td class="active-col">
                <InputCheck
                  label=""
                  ariaLabel="Is active"
                  size="lg"
                  checked={isActive}
                  onchange={e => {
                    const active = e.detail
                    const trimmedName = (channel.displayedName || '').trim()
                    const affectedIds = isValidMatch(trimmedName)
                      ? channelObjects
                          .filter(
                            c => (c.displayedName || '').trim() === trimmedName
                          )
                          .map(c => c.id)
                      : [channel.id]

                    if (active) {
                      hiddenChannelIds = hiddenChannelIds.filter(
                        id => !affectedIds.includes(id)
                      )
                    } else {
                      hiddenChannelIds = Array.from(
                        new Set([...hiddenChannelIds, ...affectedIds])
                      )
                    }
                  }}
                />
              </td>
            {:else}
              <td colspan="3">
                <div class="group-info" class:is-hidden={!isActive}>
                  rename to detach from group
                </div>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
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
    font-size: 11px;
    color: var(--c-midgrey);
    border: 1px solid var(--c-midgrey);
    border-radius: var(--rounded-md);
    padding: 0 7px;
    text-align: center;
    background: transparent;
    width: 236px;
    height: 35px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    opacity: 0.8;
    box-sizing: border-box;
  }
  .group-info.is-hidden {
    background: var(--c-lightgrey);
  }
</style>
