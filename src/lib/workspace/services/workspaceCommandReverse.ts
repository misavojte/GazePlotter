
import type { WorkspaceCommand, WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
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
  return function reverseCommand(command: WorkspaceCommandChain): WorkspaceCommandChain | null {
    try {
      switch (command.type) {
        case 'addGridItem': {
          // Reverse addGridItem to removeGridItem
          return {
            type: 'removeGridItem',
            itemId: command.itemId,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand
          }
        }

        case 'removeGridItem': {
          // Reverse removeGridItem to addGridItem
          // We need to get the item data before it was removed
          const currentItems = get(gridStore)
          const removedItem = currentItems.find(item => item.id === command.itemId)
          
          if (!removedItem) {
            console.warn(`Cannot reverse removeGridItem: item ${command.itemId} not found in current state`)
            return null
          }

          // Destructure to exclude only id and type (redrawTimestamp should be preserved)
          const { id, type, ...options } = removedItem
          
          return {
            type: 'addGridItem',
            vizType: removedItem.type,
            itemId: removedItem.id,
            options,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'duplicateGridItem': {
          // Reverse duplicateGridItem to removeGridItem (remove the duplicated item)
          // The duplicated item would have been added after the original, so we need to find it
          const currentItems = get(gridStore)
          const originalItem = currentItems.find(item => item.id === command.itemId)
          
          if (!originalItem) {
            console.warn(`Cannot reverse duplicateGridItem: original item ${command.itemId} not found`)
            return null
          }

          // Find the most recently added item of the same type (the duplicate)
          const duplicates = currentItems
            .filter(item => item.type === originalItem.type && item.id !== command.itemId)
            .sort((a, b) => b.id - a.id) // Sort by ID descending to get the most recent

          if (duplicates.length === 0) {
            console.warn(`Cannot reverse duplicateGridItem: no duplicate found for item ${command.itemId}`)
            return null
          }

          return {
            type: 'removeGridItem',
            itemId: duplicates[0].id,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateSettings': {
          // Reverse updateSettings by restoring previous settings
          const currentItems = get(gridStore)
          const currentItem = currentItems.find(item => item.id === command.itemId)
          
          if (!currentItem) {
            console.warn(`Cannot reverse updateSettings: item ${command.itemId} not found`)
            return null
          }

          // Create reverse settings by applying only the changed properties
          const reverseSettings: Partial<AllGridTypes> = {}
          
          // For each property that was changed in the original command,
          // restore it to its previous value from the current item
          Object.keys(command.settings).forEach(key => {
            if (key in currentItem) {
              (reverseSettings as any)[key] = (currentItem as any)[key]
            }
          })

          return {
            type: 'updateSettings',
            itemId: command.itemId,
            settings: reverseSettings,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
          }
        }

        case 'updateAois': {
          // Reverse updateAois by restoring previous AOI data
          const currentData = getData()
          const currentAois = currentData?.aois?.data || []
          
          // Find the AOIs that were affected by this command
          // AOI data is stored as string[][][] where each AOI is [stimulusId, aoiId, coordinates...]
          const affectedAois: ExtendedInterpretedDataType[] = []
          
          // Convert the internal data format to ExtendedInterpretedDataType
          for (let stimulusIndex = 0; stimulusIndex < currentAois.length; stimulusIndex++) {
            const stimulusAois = currentAois[stimulusIndex]
            if (stimulusIndex === command.stimulusId) {
              for (let aoiIndex = 0; aoiIndex < stimulusAois.length; aoiIndex++) {
                const aoiData = stimulusAois[aoiIndex]
                if (aoiData.length >= 3) {
                  affectedAois.push({
                    id: aoiIndex,
                    originalName: aoiData[0] || `AOI_${aoiIndex}`,
                    displayedName: aoiData[1] || `AOI ${aoiIndex}`,
                    color: aoiData[2] || '#000000'
                  })
                }
              }
            }
          }

          if (affectedAois.length === 0) {
            console.warn(`Cannot reverse updateAois: no AOIs found for stimulus ${command.stimulusId}`)
            return null
          }

          return {
            type: 'updateAois',
            aois: affectedAois,
            stimulusId: command.stimulusId,
            applyTo: command.applyTo,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
            history: 'undo'
          }
        }

        case 'updateParticipants': {
          // Reverse updateParticipants by restoring previous participant data
          const currentData = getData()
          const currentParticipants = currentData?.participants?.data || []
          
          if (currentParticipants.length === 0) {
            console.warn('Cannot reverse updateParticipants: no participants found in current data')
            return null
          }

          // Convert current participant data back to the expected format
          const participants = currentParticipants.map(([originalName, displayedName], index) => ({
            id: index,
            originalName,
            displayedName
          }))

          return {
            type: 'updateParticipants',
            participants,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
            history: 'undo'
          }
        }

        case 'updateStimuli': {
          // Reverse updateStimuli by restoring previous stimulus data
          const currentData = getData()
          const currentStimuli = currentData?.stimuli?.data || []
          
          if (currentStimuli.length === 0) {
            console.warn('Cannot reverse updateStimuli: no stimuli found in current data')
            return null
          }

          // Convert current stimulus data back to the expected format
          const stimuli = currentStimuli.map(([originalName, displayedName], index) => ({
            id: index,
            originalName,
            displayedName
          }))

          return {
            type: 'updateStimuli',
            stimuli,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
            history: 'undo'
          }
        }

        case 'updateAoiVisibility': {
          // Reverse updateAoiVisibility by restoring previous visibility settings
          const currentData = getData()
          const currentAoiVisibility = currentData?.aois?.dynamicVisibility || {}
          
          // Find the visibility data that was affected by this command
          // Visibility data is stored as key-value pairs where key is "stimulusId_aoiId_participantId"
          const affectedVisibility: { aoiName: string; visibilityArr: number[] }[] = []
          
          // Convert the internal visibility format to the expected format
          Object.entries(currentAoiVisibility).forEach(([key, visibilityArr]) => {
            const [stimulusIdStr, aoiIdStr, participantIdStr] = key.split('_')
            const stimulusId = parseInt(stimulusIdStr, 10)
            const participantId = parseInt(participantIdStr, 10)
            
            if (stimulusId === command.stimulusId &&
                (!command.participantId || participantId === command.participantId)) {
              // Get AOI name from the data store
              const aoiData = currentData?.aois?.data?.[stimulusId]?.[parseInt(aoiIdStr, 10)]
              const aoiName = aoiData?.[1] || `AOI_${aoiIdStr}`
              
              affectedVisibility.push({
                aoiName,
                visibilityArr
              })
            }
          })

          if (affectedVisibility.length === 0) {
            console.warn(`Cannot reverse updateAoiVisibility: no visibility data found for stimulus ${command.stimulusId}`)
            return null
          }

          // Extract the visibility arrays for the affected AOIs
          const visibilityArr = affectedVisibility.map(visibility => visibility.visibilityArr)
          const aoiNames = affectedVisibility.map(visibility => visibility.aoiName)

          return {
            type: 'updateAoiVisibility',
            stimulusId: command.stimulusId,
            aoiNames,
            visibilityArr,
            participantId: command.participantId,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
            history: 'undo'
          }
        }

        case 'updateParticipantsGroups': {
          // Reverse updateParticipantsGroups by restoring previous group data
          const currentData = getData()
          const currentGroups = currentData?.participantsGroups || []
          
          if (currentGroups.length === 0) {
            console.warn('Cannot reverse updateParticipantsGroups: no groups found in current data')
            return null
          }

          return {
            type: 'updateParticipantsGroups',
            groups: currentGroups,
            chainId: command.chainId,
            isRootCommand: command.isRootCommand,
            history: 'undo'
          }
        }

        default: {
          console.warn(`Cannot reverse command of type: ${(command as any).type}`)
          return null
        }
      }
    } catch (error) {
      console.error('Error reversing command:', error)
      return null
    }
  }
}