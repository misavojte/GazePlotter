import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
import type { GridStoreType } from '$lib/workspace/stores/gridStore'
import { get } from 'svelte/store'
import { getData } from '$lib/gaze-data/front-process/stores/dataStore'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'

/**
 * Creates a factory function that returns a function that reverses a workspace command.
 *
 * Reversing the command will create a new regular
 * typed command that can be used to undo the original command.
 *
 * The "add command" will be reversed to a "remove command" and vice versa.
 * The "update data command" will be reversed to a "update data command"
 * using the data in the current data store before applying the said command.
 * The "update settings command" will be reversed to a "update settings command"
 * using the settings in the current data store before applying the said command.
 *
 * All as minimal as possible, so the reverse command does not
 * occupy too much memory (snapshotting of the data store is not allowed as it
 * can be very expensive).
 *
 * @param gridStore - The grid store instance to access current state
 * @returns A function that reverses workspace commands
 */
export function createCommandReverser(gridStore: GridStoreType) {
  return function reverseCommand(
    command: WorkspaceCommandChain
  ): WorkspaceCommandChain | null {
    try {
      switch (command.type) {
        case 'addGridItem': {
          return {
            type: 'removeGridItem',
            itemId: command.itemId,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'removeGridItem': {
          const currentItems = get(gridStore)
          const removedItem = currentItems.find(
            item => item.id === command.itemId
          )
          if (!removedItem) {
            console.warn(
              `Cannot reverse removeGridItem: item ${command.itemId} not found in current state`
            )
            return null
          }
          const { id, type, redrawTimestamp, ...options } = removedItem
          return {
            type: 'addGridItem',
            vizType: removedItem.type,
            itemId: removedItem.id,
            options: { ...options, id: removedItem.id },
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'duplicateGridItem': {
          if (!command.duplicateId) {
            console.warn(
              `Cannot reverse duplicateGridItem: duplicateId not found in command`
            )
            return null
          }
          return {
            type: 'removeGridItem',
            itemId: command.duplicateId,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateSettings': {
          const currentItems = get(gridStore)
          const currentItem = currentItems.find(
            item => item.id === command.itemId
          )
          if (!currentItem) {
            console.warn(
              `Cannot reverse updateSettings: item ${command.itemId} not found`
            )
            return null
          }
          const reverseSettings: Partial<AllGridTypes> = {}
          Object.keys(command.settings).forEach(key => {
            if (key in currentItem) {
              ;(reverseSettings as any)[key] = (currentItem as any)[key]
            } else if (key === 'highlights') {
              ;(reverseSettings as any)[key] = []
            }
          })
          return {
            type: 'updateSettings',
            itemId: command.itemId,
            settings: reverseSettings,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateAois': {
          const currentData = getData()
          const stimulusId = command.stimulusId
          const currentAois = currentData?.aois?.data?.[stimulusId] || []
          if (currentAois.length === 0) {
            console.warn(
              `Cannot reverse updateAois: no AOIs found for stimulus ${stimulusId}`
            )
            return null
          }
          const affectedAois: ExtendedInterpretedDataType[] = []
          const DEFAULT_COLORS = [
            '#66c5cc',
            '#f6cf71',
            '#f89c74',
            '#dcb0f2',
            '#87c55f',
          ]
          for (let aoiIndex = 0; aoiIndex < currentAois.length; aoiIndex++) {
            const aoiRow = currentAois[aoiIndex]
            const originalName = aoiRow?.[0] ?? ''
            const displayedName = aoiRow?.[1] ?? originalName
            const color =
              aoiRow?.[2] ?? DEFAULT_COLORS[aoiIndex % DEFAULT_COLORS.length]
            affectedAois.push({
              id: aoiIndex,
              originalName,
              displayedName,
              color,
            })
          }
          const shouldIncludeHiddenAois = command.hiddenAois !== undefined
          const hiddenAois = currentData?.aois?.hiddenAois?.[stimulusId] ?? []
          return {
            type: 'updateAois',
            aois: affectedAois,
            stimulusId,
            applyTo: command.applyTo,
            ...(shouldIncludeHiddenAois ? { hiddenAois: [...hiddenAois] } : {}),
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateParticipants': {
          const currentData = getData()
          const currentParticipants = currentData?.participants?.data || []
          if (currentParticipants.length === 0) {
            console.warn(
              'Cannot reverse updateParticipants: no participants found in current data'
            )
            return null
          }
          const participants = currentParticipants.map(
            ([originalName, displayedName], index) => ({
              id: index,
              originalName,
              displayedName,
            })
          )
          return {
            type: 'updateParticipants',
            participants,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateStimuli': {
          const currentData = getData()
          const currentStimuli = currentData?.stimuli?.data || []
          if (currentStimuli.length === 0) {
            console.warn(
              'Cannot reverse updateStimuli: no stimuli found in current data'
            )
            return null
          }
          const stimuli = currentStimuli.map(
            ([originalName, displayedName], index) => ({
              id: index,
              originalName,
              displayedName,
            })
          )
          return {
            type: 'updateStimuli',
            stimuli,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateAoiVisibility': {
          const currentData = getData()
          const currentAoiVisibility =
            currentData?.aois?.dynamicVisibility || {}
          const affectedVisibility: {
            aoiName: string
            visibilityArr: number[]
          }[] = []
          Object.entries(currentAoiVisibility).forEach(
            ([key, visibilityArr]) => {
              const [stimulusIdStr, aoiIdStr, participantIdStr] = key.split('_')
              const stimulusId = parseInt(stimulusIdStr, 10)
              const participantId = parseInt(participantIdStr, 10)
              if (
                stimulusId === command.stimulusId &&
                (!command.participantId ||
                  participantId === command.participantId)
              ) {
                const aoiData =
                  currentData?.aois?.data?.[stimulusId]?.[
                    parseInt(aoiIdStr, 10)
                  ]
                const aoiName = aoiData?.[1] || `AOI_${aoiIdStr}`
                affectedVisibility.push({ aoiName, visibilityArr })
              }
            }
          )
          if (affectedVisibility.length === 0) {
            console.warn(
              `Cannot reverse updateAoiVisibility: no visibility data found for stimulus ${command.stimulusId}`
            )
            return null
          }
          const visibilityArr = affectedVisibility.map(v => v.visibilityArr)
          const aoiNames = affectedVisibility.map(v => v.aoiName)
          return {
            type: 'updateAoiVisibility',
            stimulusId: command.stimulusId,
            aoiNames,
            visibilityArr,
            participantId: command.participantId,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateParticipantsGroups': {
          const currentData = getData()
          const currentGroups = currentData?.participantsGroups || []
          if (currentGroups.length === 0) {
            console.warn(
              'Cannot reverse updateParticipantsGroups: no groups found in current data'
            )
            return null
          }
          return {
            type: 'updateParticipantsGroups',
            groups: currentGroups,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateNoAoiTreatment': {
          const currentData = getData()
          const currentNoAoiTreatment = currentData?.noAoiTreatment
          if (!currentNoAoiTreatment) {
            console.warn(
              'Cannot reverse updateNoAoiTreatment: no treatment found in current data'
            )
            return null
          }
          return {
            type: 'updateNoAoiTreatment',
            noAoiTreatment: currentNoAoiTreatment,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'setLayoutState': {
          const currentItems = get(gridStore)
          const currentLayoutState = currentItems.map(item => {
            const { redrawTimestamp, ...itemData } = item
            return itemData as Partial<AllGridTypes> & { type: string }
          })
          return {
            type: 'setLayoutState',
            layoutState: currentLayoutState,
            source: command.source,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        default: {
          console.warn(
            `Cannot reverse command of type: ${(command as any).type}`
          )
          return null
        }
      }
    } catch (error) {
      console.error('Error reversing command:', error)
      return null
    }
  }
}
