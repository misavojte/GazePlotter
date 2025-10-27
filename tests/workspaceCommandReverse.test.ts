import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createCommandReverser } from '$lib/workspace/services/workspaceCommandReverse'
import type { WorkspaceCommandChain } from '$lib/shared/types/workspaceInstructions'
import type { GridStoreType } from '$lib/workspace/stores/gridStore'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

// Mock the data store
vi.mock('$lib/gaze-data/front-process/stores/dataStore', () => ({
  getData: vi.fn()
}))

// Mock svelte store
vi.mock('svelte/store', () => ({
  get: vi.fn()
}))

import { getData } from '$lib/gaze-data/front-process/stores/dataStore'
import { get } from 'svelte/store'

describe('createCommandReverser', () => {
  let mockGridStore: GridStoreType
  let mockData: any
  let reverseCommand: (command: WorkspaceCommandChain) => any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Mock grid store
    mockGridStore = {
      subscribe: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      triggerRedraw: vi.fn(),
      reset: vi.fn(),
      updateSettings: vi.fn(),
      removeItem: vi.fn(),
      duplicateItem: vi.fn(),
      batchDuplicateItems: vi.fn(),
      addItem: vi.fn(),
      resolveItemPositionCollisions: vi.fn()
    } as any

    // Mock data store
    mockData = {
      aois: {
        data: [
          [], // stimulus 0
          [ // stimulus 1
            ['AOI1', 'AOI 1', '#FF0000', '0,0,100,100'], // [originalName, displayedName, color, coordinates]
            ['AOI2', 'AOI 2', '#00FF00', '100,100,200,200']
          ]
        ],
        dynamicVisibility: {
          '1_0_1': [0, 100, 104, 120], // stimulusId_aoiId_participantId: visibility blocks
          '1_1_1': [10, 20, 30, 40]
        }
      },
      participants: {
        data: [
          ['Participant1', 'Participant 1'],
          ['Participant2', 'Participant 2']
        ]
      },
      stimuli: {
        data: [
          ['Stimulus1', 'Stimulus 1'],
          ['Stimulus2', 'Stimulus 2']
        ]
      },
      participantsGroups: [
        {
          id: 1,
          name: 'Group 1',
          participantIds: [1, 2]
        }
      ]
    }

    vi.mocked(getData).mockReturnValue(mockData)
    vi.mocked(get).mockImplementation((store) => {
      if (store === mockGridStore) {
        return [
          {
            id: 1,
            type: 'scarf',
            x: 0,
            y: 0,
            w: 6,
            h: 8,
            min: { w: 4, h: 4 },
            stimulusId: 1,
            redrawTimestamp: Date.now()
          },
          {
            id: 2,
            type: 'barPlot',
            x: 6,
            y: 0,
            w: 6,
            h: 8,
            min: { w: 4, h: 4 },
            stimulusId: 1,
            redrawTimestamp: Date.now()
          }
        ] as AllGridTypes[]
      }
      return []
    })

    reverseCommand = createCommandReverser(mockGridStore)
  })

  describe('addGridItem command reversal', () => {
    it('should reverse addGridItem to removeGridItem', () => {
      const command: WorkspaceCommandChain = {
        type: 'addGridItem',
        vizType: 'scarf',
        itemId: 123,
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 123,
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })
  })

  describe('removeGridItem command reversal', () => {
    it('should reverse removeGridItem to addGridItem with correct settings', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 1,
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'addGridItem',
        vizType: 'scarf',
        itemId: 1,
        options: {
          id: 1,
          x: 0,
          y: 0,
          w: 6,
          h: 8,
          min: { w: 4, h: 4 },
          stimulusId: 1
        },
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if item not found in current state', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 999,
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('duplicateGridItem command reversal', () => {
    it('should reverse duplicateGridItem to removeGridItem for the duplicate', () => {
      // Mock grid store with two items of the same type
      vi.mocked(get).mockImplementation((store) => {
        if (store === mockGridStore) {
          return [
            {
              id: 1,
              type: 'scarf',
              x: 0,
              y: 0,
              w: 6,
              h: 8,
              min: { w: 4, h: 4 },
              stimulusId: 1,
              redrawTimestamp: Date.now()
            },
            {
              id: 2,
              type: 'scarf', // Same type as original
              x: 6,
              y: 0,
              w: 6,
              h: 8,
              min: { w: 4, h: 4 },
              stimulusId: 1,
              redrawTimestamp: Date.now()
            }
          ] as AllGridTypes[]
        }
        return []
      })

      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 1,
        duplicateId: 2, // The ID of the duplicated item
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 2, // The duplicate (scarf item)
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should reverse duplicateGridItem even if original item not found in grid', () => {
      // The implementation doesn't validate if the original item exists
      // It just creates a reverse command using duplicateId
      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 999, // Original item doesn't exist
        duplicateId: 998, // But duplicateId is provided
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      // Should return a valid reverse command because duplicateId is provided
      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 998, // Uses duplicateId, not itemId
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no duplicate found', () => {
      // Mock grid store with only one item
      vi.mocked(get).mockImplementation((store) => {
        if (store === mockGridStore) {
          return [
            {
              id: 1,
              type: 'scarf',
              x: 0,
              y: 0,
              w: 6,
              h: 8,
              min: { w: 4, h: 4 },
              stimulusId: 1,
              redrawTimestamp: Date.now()
            }
          ] as AllGridTypes[]
        }
        return []
      })

      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 1,
        // No duplicateId property - implementation should return null
        chainId: 1,
        isRootCommand: true
      } as any // Using 'as any' because duplicateId is missing intentionally

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateSettings command reversal', () => {
    it('should reverse updateSettings by restoring previous settings', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateSettings',
        itemId: 1,
        settings: { x: 10, y: 20, w: 8 },
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateSettings',
        itemId: 1,
        settings: {
          x: 0,
          y: 0,
          w: 6
        },
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if item not found', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateSettings',
        itemId: 999,
        settings: { x: 10, y: 20 },
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateAois command reversal', () => {
    it('should reverse updateAois by restoring current AOI data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAois',
        aois: [],
        stimulusId: 1,
        applyTo: 'this_stimulus',
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateAois',
        aois: [
          {
            id: 0,
            originalName: 'AOI1',
            displayedName: 'AOI 1',
            color: '#FF0000'
          },
          {
            id: 1,
            originalName: 'AOI2',
            displayedName: 'AOI 2',
            color: '#00FF00'
          }
        ],
        stimulusId: 1,
        applyTo: 'this_stimulus',
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no AOIs found for stimulus', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAois',
        aois: [],
        stimulusId: 999,
        applyTo: 'this_stimulus',
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateParticipants command reversal', () => {
    it('should reverse updateParticipants by restoring current participant data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipants',
        participants: [
          { id: 0, originalName: 'Participant1', displayedName: 'Participant 1' },
          { id: 1, originalName: 'Participant2', displayedName: 'Participant 2' }
        ],
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no participants found', () => {
      vi.mocked(getData).mockReturnValue({ 
        participants: { data: [], orderVector: [] },
        isOrdinalOnly: false,
        aois: { data: [], orderVector: [], dynamicVisibility: {} },
        categories: { data: [], orderVector: [] },
        participantsGroups: [],
        stimuli: { data: [], orderVector: [] },
        segments: []
      })

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateStimuli command reversal', () => {
    it('should reverse updateStimuli by restoring current stimulus data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateStimuli',
        stimuli: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateStimuli',
        stimuli: [
          { id: 0, originalName: 'Stimulus1', displayedName: 'Stimulus 1' },
          { id: 1, originalName: 'Stimulus2', displayedName: 'Stimulus 2' }
        ],
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no stimuli found', () => {
      vi.mocked(getData).mockReturnValue({ 
        stimuli: { data: [], orderVector: [] },
        isOrdinalOnly: false,
        aois: { data: [], orderVector: [], dynamicVisibility: {} },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        participantsGroups: [],
        segments: []
      })

      const command: WorkspaceCommandChain = {
        type: 'updateStimuli',
        stimuli: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateAoiVisibility command reversal', () => {
    it('should reverse updateAoiVisibility by restoring current visibility data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAoiVisibility',
        stimulusId: 1,
        aoiNames: ['AOI1'],
        visibilityArr: [[1, 0, 1]],
        participantId: 1,
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateAoiVisibility',
        stimulusId: 1,
        aoiNames: ['AOI 1', 'AOI 2'],
        visibilityArr: [[0, 100, 104, 120], [10, 20, 30, 40]],
        participantId: 1,
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no visibility data found', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAoiVisibility',
        stimulusId: 999,
        aoiNames: ['AOI1'],
        visibilityArr: [[1, 0, 1]],
        participantId: 1,
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateParticipantsGroups command reversal', () => {
    it('should reverse updateParticipantsGroups by restoring current group data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateParticipantsGroups',
        groups: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipantsGroups',
        groups: [
          {
            id: 1,
            name: 'Group 1',
            participantIds: [1, 2]
          }
        ],
        source: undefined,
        chainId: 1,
        isRootCommand: true
      })
    })

    it('should return null if no groups found', () => {
      vi.mocked(getData).mockReturnValue({ 
        participantsGroups: [],
        isOrdinalOnly: false,
        aois: { data: [], orderVector: [], dynamicVisibility: {} },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        stimuli: { data: [], orderVector: [] },
        segments: []
      })

      const command: WorkspaceCommandChain = {
        type: 'updateParticipantsGroups',
        groups: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should return null for unknown command types', () => {
      const command = {
        type: 'unknownCommand',
        chainId: 1,
        isRootCommand: true
      } as any

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })

    it('should handle errors gracefully and return null', () => {
      // Mock getData to throw an error
      vi.mocked(getData).mockImplementation(() => {
        throw new Error('Data store error')
      })

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle empty data store gracefully', () => {
      vi.mocked(getData).mockReturnValue({
        isOrdinalOnly: false,
        aois: { data: [], orderVector: [], dynamicVisibility: {} },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        participantsGroups: [],
        stimuli: { data: [], orderVector: [] },
        segments: []
      })

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })

    it('should handle null data store gracefully', () => {
      vi.mocked(getData).mockReturnValue(null as any)

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })

    it('should handle undefined data store gracefully', () => {
      vi.mocked(getData).mockReturnValue(undefined as any)

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        chainId: 1,
        isRootCommand: true
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('functional programming principles', () => {
    it('should be a pure function that does not mutate input', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateSettings',
        itemId: 1,
        settings: { x: 10, y: 20 },
        chainId: 1,
        isRootCommand: true
      }

      const originalCommand = JSON.parse(JSON.stringify(command))
      
      reverseCommand(command)

      expect(command).toEqual(originalCommand)
    })

    it('should return consistent results for the same input', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 1,
        chainId: 1,
        isRootCommand: true
      }

      const result1 = reverseCommand(command)
      const result2 = reverseCommand(command)

      expect(result1).toEqual(result2)
    })
  })
})
