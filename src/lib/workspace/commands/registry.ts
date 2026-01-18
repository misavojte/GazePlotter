import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
import { createChildCommand } from '$lib/shared/types/workspaceInstructions'
import { IDENTIFIER_IS_AOI } from '$lib/plots/scarf/const/identifiers'
import type { GridStoreType } from '$lib/workspace/stores/gridStore'
import { get } from 'svelte/store'
import {
  getData,
  updateHiddenAoisWithPropagation,
  updateMultipleAoi,
  updateMultipleAoiVisibility,
  updateMultipleParticipants,
  updateMultipleStimuli,
  updateNoAoiTreatment,
  updateParticipantsGroups,
} from '$lib/gaze-data/front-process/stores/dataStore'
import type { AllGridTypes } from '$lib/workspace/type/gridType'
import type { ExtendedInterpretedDataType } from '$lib/gaze-data/shared/types'

const DEFAULT_AOI_COLORS = [
  '#66c5cc',
  '#f6cf71',
  '#f89c74',
  '#dcb0f2',
  '#87c55f',
]

export type WorkspaceCommandDispatcher = (
  command: WorkspaceCommandChain
) => void

export type WorkspaceCommandExecutionContext = {
  isUndoRedoOperation: boolean
  dispatch: WorkspaceCommandDispatcher
}

type CommandMeta = Pick<
  WorkspaceCommandChain,
  'source' | 'chainId' | 'isRootCommand'
>

type CommandSpec = {
  execute?: (command: any, context: WorkspaceCommandExecutionContext) => void
  reverse?: (command: any, meta: CommandMeta) => WorkspaceCommandChain | null
}

export type WorkspaceCommandRegistry = {
  execute: (
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ) => void
  reverse: (command: WorkspaceCommandChain) => WorkspaceCommandChain | null
}

export function createWorkspaceCommandRegistry(
  gridStore: GridStoreType
): WorkspaceCommandRegistry {
  const withMeta = (base: object, meta: CommandMeta): WorkspaceCommandChain => {
    return { ...base, ...meta } as unknown as WorkspaceCommandChain
  }

  function emitCollisionResolutionChildren(
    priorityItemId: number,
    chainId: number,
    context: WorkspaceCommandExecutionContext
  ): void {
    const collisionCommands =
      gridStore.resolveItemPositionCollisions(priorityItemId)
    collisionCommands.forEach(collisionCommand => {
      context.dispatch(
        createChildCommand(
          {
            type: 'updateSettings',
            itemId: collisionCommand.itemId,
            settings: collisionCommand.settings,
            source: 'collision',
          },
          chainId
        )
      )
    })
  }

  type AoiLike = { id: string | number }

  function sanitizeScarfHighlightsAfterAoiRename(
    command: Extract<WorkspaceCommandChain, { type: 'updateAois' }>,
    context: WorkspaceCommandExecutionContext
  ) {
    if (!command.isRootCommand || context.isUndoRedoOperation) return

    const renamedAois = (command.aois || []) as AoiLike[]
    const affectedIdentifiers = new Set<string>(
      renamedAois.map(a => `${IDENTIFIER_IS_AOI}${a.id}`)
    )

    get(gridStore).forEach(item => {
      if (item.type !== 'scarf') return
      const highlights: string[] = (item as any).highlights || []
      const hasMatch = highlights.some(h => affectedIdentifiers.has(h))
      if (!hasMatch) return

      const newHighlights = highlights.filter(h => !affectedIdentifiers.has(h))
      if (newHighlights.length === highlights.length) return

      context.dispatch(
        createChildCommand(
          {
            type: 'updateSettings',
            itemId: item.id,
            settings: { highlights: newHighlights },
            source: 'aoi.rename',
          },
          command.chainId
        )
      )
    })
  }

  const specs: Partial<Record<WorkspaceCommandChain['type'], CommandSpec>> = {
    updateAois: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'updateAois' }>,
        context
      ) => {
        const { aois, stimulusId, applyTo, hiddenAois } = command
        updateMultipleAoi(aois, stimulusId, applyTo)
        if (hiddenAois !== undefined) {
          updateHiddenAoisWithPropagation(stimulusId, hiddenAois, applyTo)
        }
        gridStore.triggerRedraw()
        sanitizeScarfHighlightsAfterAoiRename(command, context)
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'updateAois' }>,
        meta
      ) => {
        const currentData = getData()
        const stimulusId = cmd.stimulusId
        const currentAois = currentData?.aois?.data?.[stimulusId] || []
        if (currentAois.length === 0) {
          console.warn(
            `Cannot reverse updateAois: no AOIs found for stimulus ${stimulusId}`
          )
          return null
        }
        const affectedAois: ExtendedInterpretedDataType[] = []
        for (let aoiIndex = 0; aoiIndex < currentAois.length; aoiIndex++) {
          const aoiRow = currentAois[aoiIndex]
          const originalName = aoiRow?.[0] ?? ''
          const displayedName = aoiRow?.[1] ?? originalName
          const color =
            aoiRow?.[2] ??
            DEFAULT_AOI_COLORS[aoiIndex % DEFAULT_AOI_COLORS.length]
          affectedAois.push({
            id: aoiIndex,
            originalName,
            displayedName,
            color,
          })
        }
        const shouldIncludeHiddenAois = cmd.hiddenAois !== undefined
        const hiddenAois = currentData?.aois?.hiddenAois?.[stimulusId] ?? []
        return withMeta(
          {
            type: 'updateAois',
            aois: affectedAois,
            stimulusId,
            applyTo: cmd.applyTo,
            ...(shouldIncludeHiddenAois ? { hiddenAois: [...hiddenAois] } : {}),
          },
          meta
        )
      },
    },

    updateParticipants: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'updateParticipants' }>
      ) => {
        updateMultipleParticipants(command.participants)
        gridStore.triggerRedraw()
      },
      reverse: (_cmd, meta) => {
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
        return withMeta({ type: 'updateParticipants', participants }, meta)
      },
    },

    updateStimuli: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'updateStimuli' }>
      ) => {
        updateMultipleStimuli(command.stimuli)
        gridStore.triggerRedraw()
      },
      reverse: (_cmd, meta) => {
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
        return withMeta({ type: 'updateStimuli', stimuli }, meta)
      },
    },

    updateAoiVisibility: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'updateAoiVisibility' }>
      ) => {
        const { stimulusId, aoiNames, visibilityArr, participantId } = command
        updateMultipleAoiVisibility(
          stimulusId,
          aoiNames,
          visibilityArr,
          participantId
        )
        gridStore.triggerRedraw()
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'updateAoiVisibility' }>,
        meta
      ) => {
        const currentData = getData()
        const currentAoiVisibility = currentData?.aois?.dynamicVisibility || {}
        const affectedVisibility: {
          aoiName: string
          visibilityArr: number[]
        }[] = []

        Object.entries(currentAoiVisibility).forEach(([key, visibilityArr]) => {
          const [stimulusIdStr, aoiIdStr, participantIdStr] = key.split('_')
          const stimulusId = parseInt(stimulusIdStr, 10)
          const participantId = parseInt(participantIdStr, 10)
          if (
            stimulusId === cmd.stimulusId &&
            (!cmd.participantId || participantId === cmd.participantId)
          ) {
            const aoiData =
              currentData?.aois?.data?.[stimulusId]?.[parseInt(aoiIdStr, 10)]
            const aoiName = aoiData?.[1] || `AOI_${aoiIdStr}`
            affectedVisibility.push({ aoiName, visibilityArr })
          }
        })

        if (affectedVisibility.length === 0) {
          console.warn(
            `Cannot reverse updateAoiVisibility: no visibility data found for stimulus ${cmd.stimulusId}`
          )
          return null
        }

        const visibilityArr = affectedVisibility.map(v => v.visibilityArr)
        const aoiNames = affectedVisibility.map(v => v.aoiName)
        return withMeta(
          {
            type: 'updateAoiVisibility',
            stimulusId: cmd.stimulusId,
            aoiNames,
            visibilityArr,
            participantId: cmd.participantId,
          },
          meta
        )
      },
    },

    updateParticipantsGroups: {
      execute: (
        command: Extract<
          WorkspaceCommandChain,
          { type: 'updateParticipantsGroups' }
        >
      ) => {
        updateParticipantsGroups(command.groups)
        gridStore.triggerRedraw()
      },
      reverse: (_cmd, meta) => {
        const currentData = getData()
        const currentGroups = currentData?.participantsGroups || []
        if (currentGroups.length === 0) {
          console.warn(
            'Cannot reverse updateParticipantsGroups: no groups found in current data'
          )
          return null
        }
        return withMeta(
          { type: 'updateParticipantsGroups', groups: currentGroups },
          meta
        )
      },
    },

    updateNoAoiTreatment: {
      execute: (
        command: Extract<
          WorkspaceCommandChain,
          { type: 'updateNoAoiTreatment' }
        >
      ) => {
        updateNoAoiTreatment(command.noAoiTreatment)
        gridStore.triggerRedraw()
      },
      reverse: (_cmd, meta) => {
        const currentData = getData()
        const currentNoAoiTreatment = currentData?.noAoiTreatment
        if (!currentNoAoiTreatment) {
          console.warn(
            'Cannot reverse updateNoAoiTreatment: no treatment found in current data'
          )
          return null
        }
        return withMeta(
          {
            type: 'updateNoAoiTreatment',
            noAoiTreatment: currentNoAoiTreatment,
          },
          meta
        )
      },
    },

    updateSettings: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'updateSettings' }>,
        context
      ) => {
        const { itemId, settings } = command
        const currentItem = get(gridStore).find(item => item.id === itemId)
        if (!currentItem) throw new Error(`Grid item ${itemId} not found`)

        gridStore.updateItem(itemId, {
          ...settings,
          redrawTimestamp: Date.now(),
        })

        if (command.isRootCommand && !context.isUndoRedoOperation) {
          emitCollisionResolutionChildren(itemId, command.chainId, context)
        }
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'updateSettings' }>,
        meta
      ) => {
        const currentItems = get(gridStore)
        const currentItem = currentItems.find(item => item.id === cmd.itemId)
        if (!currentItem) {
          console.warn(
            `Cannot reverse updateSettings: item ${cmd.itemId} not found`
          )
          return null
        }
        const reverseSettings: Partial<AllGridTypes> = {}
        Object.keys(cmd.settings).forEach(key => {
          if (key === 'highlights') {
            // Special-case: resetting highlights to an empty array
            ;(
              reverseSettings as Partial<AllGridTypes> & {
                highlights?: unknown[]
              }
            ).highlights = []
          } else if (key === 'type') {
            return
          } else if (key in currentItem) {
            const typedKey = key as keyof AllGridTypes
            Object.assign(reverseSettings, {
              [typedKey]: currentItem[typedKey],
            })
          }
        })
        return withMeta(
          {
            type: 'updateSettings',
            itemId: cmd.itemId,
            settings: reverseSettings,
          },
          meta
        )
      },
    },

    addGridItem: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'addGridItem' }>,
        context
      ) => {
        const { vizType, options, itemId } = command
        const createdId = gridStore.addItem(vizType, { ...options, id: itemId })
        if (command.isRootCommand && !context.isUndoRedoOperation) {
          emitCollisionResolutionChildren(createdId, command.chainId, context)
        }
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'addGridItem' }>,
        meta
      ) => withMeta({ type: 'removeGridItem', itemId: cmd.itemId }, meta),
    },

    removeGridItem: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'removeGridItem' }>
      ) => {
        gridStore.removeItem(command.itemId)
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'removeGridItem' }>,
        meta
      ) => {
        const currentItems = get(gridStore)
        const removedItem = currentItems.find(item => item.id === cmd.itemId)
        if (!removedItem) {
          console.warn(
            `Cannot reverse removeGridItem: item ${cmd.itemId} not found in current state`
          )
          return null
        }
        const { id, type, redrawTimestamp, ...options } = removedItem
        return withMeta(
          {
            type: 'addGridItem',
            vizType: removedItem.type,
            itemId: removedItem.id,
            options: { ...options, id: removedItem.id },
          },
          meta
        )
      },
    },

    duplicateGridItem: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'duplicateGridItem' }>,
        context
      ) => {
        const currentItem = get(gridStore).find(
          item => item.id === command.itemId
        )
        if (!currentItem)
          throw new Error(`Grid item ${command.itemId} not found`)

        const createdId = gridStore.duplicateItem(
          currentItem,
          command.duplicateId
        )
        if (command.isRootCommand && !context.isUndoRedoOperation) {
          emitCollisionResolutionChildren(createdId, command.chainId, context)
        }
      },
      reverse: (
        cmd: Extract<WorkspaceCommandChain, { type: 'duplicateGridItem' }>,
        meta
      ) => {
        if (!cmd.duplicateId) {
          console.warn(
            `Cannot reverse duplicateGridItem: duplicateId not found in command`
          )
          return null
        }
        return withMeta(
          { type: 'removeGridItem', itemId: cmd.duplicateId },
          meta
        )
      },
    },

    setLayoutState: {
      execute: (
        command: Extract<WorkspaceCommandChain, { type: 'setLayoutState' }>
      ) => {
        gridStore.setLayoutState(command.layoutState)
      },
      reverse: (_cmd, meta) => {
        const currentItems = get(gridStore)
        const currentLayoutState = currentItems.map(item => {
          const { redrawTimestamp, ...itemData } = item
          return itemData as Partial<AllGridTypes> & { type: string }
        })
        return withMeta(
          { type: 'setLayoutState', layoutState: currentLayoutState },
          meta
        )
      },
    },
  }

  function execute(
    command: WorkspaceCommandChain,
    context: WorkspaceCommandExecutionContext
  ) {
    const spec = specs[command.type]
    spec?.execute?.(command as any, context)
  }

  function reverse(
    command: WorkspaceCommandChain
  ): WorkspaceCommandChain | null {
    try {
      const spec = specs[command.type]
      if (!spec?.reverse) {
        console.warn(`Cannot reverse command of type: ${(command as any).type}`)
        return null
      }

      const meta: CommandMeta = {
        source: command.source,
        chainId: command.chainId,
        isRootCommand: command.isRootCommand,
      }

      return spec.reverse(command as any, meta)
    } catch (error) {
      console.error('Error reversing command:', error)
      return null
    }
  }

  return { execute, reverse }
}
