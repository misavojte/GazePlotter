import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'
import type { AllGridTypes } from '$lib/workspace/type/gridType'

const mockEngine = {
  metadata: null,
}

describe('workspaceCommandReverse', () => {
  let mockGridStore: GridState
  let mockData: any
  let reverseCommand: (command: WorkspaceCommandChain) => any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Ensure engine.metadata is a writable value property, not a getter from previous tests
    Object.defineProperty(mockEngine, 'metadata', {
      value: null,
      writable: true,
      configurable: true,
    })

    // Mock grid store as a GridState-like object
    mockGridStore = {
      items: [],
      triggerRedraw: vi.fn(),
      reset: vi.fn(),
      updateSettings: vi.fn(),
      updateLayout: vi.fn(),
      removeItem: vi.fn(),
      duplicateItem: vi.fn(),
      batchDuplicateItems: vi.fn(),
      addItem: vi.fn(),
      resolveItemPositionCollisions: vi.fn(),
      setLayoutState: vi.fn(),
      updateItem: vi.fn(),
    } as any

    // Mock data store
    mockData = {
      aois: {
        data: [
          [], // stimulus 0
          [
            // stimulus 1
            ['AOI1', 'AOI 1', '#FF0000', '0,0,100,100'], // [originalName, displayedName, color, coordinates]
            ['AOI2', 'AOI 2', '#00FF00', '100,100,200,200'],
          ],
        ],
        dynamicVisibility: {
          '1_0_1': [0, 100, 104, 120], // stimulusId_aoiId_participantId: visibility blocks
          '1_1_1': [10, 20, 30, 40],
        },
        hiddenAois: [],
        orderVector: [],
      },
      participants: {
        data: [
          ['Participant1', 'Participant 1'],
          ['Participant2', 'Participant 2'],
        ],
        orderVector: [],
      },
      stimuli: {
        data: [
          ['Stimulus1', 'Stimulus 1'],
          ['Stimulus2', 'Stimulus 2'],
        ],
        orderVector: [],
      },
      categories: {
        data: [],
        orderVector: [],
      },
      participantsGroups: [
        {
          id: 1,
          name: 'Group 1',
          participantIds: [1, 2],
        },
      ],
      noAoiTreatment: {
        displayedName: 'No AOI',
        color: '#CCCCCC',
      },
      isOrdinalOnly: false,
    }

    // @ts-ignore
    mockEngine.metadata = mockData

    // Provide current items directly on the mock grid store
    mockGridStore.items = [
      {
        id: 1,
        type: 'scarf',
        x: 0,
        y: 0,
        w: 6,
        h: 8,
        min: { w: 4, h: 4 },
        settings: {
          stimulusId: 1,
          groupId: -1,
          timeline: 'absolute',
          absoluteStimuliLimits: [],
          ordinalStimuliLimits: [],
          dynamicAOI: true,
        },
        redrawTimestamp: Date.now(),
      },
      {
        id: 2,
        type: 'barPlot',
        x: 6,
        y: 0,
        w: 6,
        h: 8,
        min: { w: 4, h: 4 },
        settings: {
          stimulusId: 1,
          groupId: -1,
          barPlottingType: 'horizontal',
          orderBy: 'aoi',
          orderDirection: 'asc',
          aggregationMethod: 'absoluteTime',
          scaleRange: [0, 0],
        },
        redrawTimestamp: Date.now(),
      },
    ] as AllGridTypes[]

    reverseCommand = createWorkspaceCommandRegistry(
      mockGridStore as any,
      mockEngine as any
    ).reverse
  })

  describe('addGridItem command reversal', () => {
    it('should reverse addGridItem to removeGridItem', () => {
      const command: WorkspaceCommandChain = {
        type: 'addGridItem',
        vizType: 'scarf',
        itemId: 123,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 123,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })
  })

  describe('removeGridItem command reversal', () => {
    it('should reverse removeGridItem to addGridItem with correct settings', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 1,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
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
          settings: {
            stimulusId: 1,
            groupId: -1,
            timeline: 'absolute',
            absoluteStimuliLimits: [],
            ordinalStimuliLimits: [],
            dynamicAOI: true,
          },
        },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return null if item not found in current state', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 999,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('duplicateGridItem command reversal', () => {
    it('should reverse duplicateGridItem to removeGridItem for the duplicate', () => {
      // Mock grid store with two items of the same type
      mockGridStore.items = [
        {
          id: 1,
          type: 'scarf',
          x: 0,
          y: 0,
          w: 6,
          h: 8,
          min: { w: 4, h: 4 },
          settings: {
            stimulusId: 1,
            groupId: -1,
            timeline: 'absolute',
            absoluteStimuliLimits: [],
            ordinalStimuliLimits: [],
            dynamicAOI: true,
          },
          redrawTimestamp: Date.now(),
        },
        {
          id: 2,
          type: 'scarf', // Same type as original
          x: 6,
          y: 0,
          w: 6,
          h: 8,
          min: { w: 4, h: 4 },
          settings: {
            stimulusId: 1,
            groupId: -1,
            timeline: 'absolute',
            absoluteStimuliLimits: [],
            ordinalStimuliLimits: [],
            dynamicAOI: true,
          },
          redrawTimestamp: Date.now(),
        },
      ] as AllGridTypes[]

      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 1,
        duplicateId: 2, // The ID of the duplicated item
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 2, // The duplicate (scarf item)
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should reverse duplicateGridItem even if original item not found in grid', () => {
      // The implementation doesn't validate if the original item exists
      // It just creates a reverse command using duplicateId
      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 999, // Original item doesn't exist
        duplicateId: 998, // But duplicateId is provided
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      // Should return a valid reverse command because duplicateId is provided
      expect(result).toEqual({
        type: 'removeGridItem',
        itemId: 998, // Uses duplicateId, not itemId
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return null if no duplicate found', () => {
      // Mock grid store with only one item
      mockGridStore.items = [
        {
          id: 1,
          type: 'scarf',
          x: 0,
          y: 0,
          w: 6,
          h: 8,
          min: { w: 4, h: 4 },
          settings: {
            stimulusId: 1,
            groupId: -1,
            timeline: 'absolute',
            absoluteStimuliLimits: [],
            ordinalStimuliLimits: [],
            dynamicAOI: true,
          },
          redrawTimestamp: Date.now(),
        },
      ] as AllGridTypes[]

      const command: WorkspaceCommandChain = {
        type: 'duplicateGridItem',
        itemId: 1,
        // No duplicateId property - implementation should return null
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      } as any // Using 'as any' because duplicateId is missing intentionally

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('updateLayout command reversal', () => {
    it('should reverse updateLayout by restoring previous layout', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateLayout',
        itemId: 1,
        layout: { x: 10, y: 20, w: 8 },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateLayout',
        itemId: 1,
        layout: {
          x: 0,
          y: 0,
          w: 6,
        },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return null if item not found', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateLayout',
        itemId: 999,
        layout: { x: 10, y: 20 },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
    it('should reverse updateSettings by restoring previous plot settings', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateSettings',
        itemId: 1,
        settings: { timeline: 'relative', hideNonFixations: true },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateSettings',
        itemId: 1,
        settings: {
          timeline: 'absolute',
          hideNonFixations: undefined,
        },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })
  })

  describe('updateAois command reversal', () => {
    it('should reverse updateAois by restoring current AOI data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAois',
        aois: [],
        stimulusId: 1,
        applyTo: 'this_stimulus',
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateAois',
        aois: [
          {
            id: 0,
            originalName: 'AOI1',
            displayedName: 'AOI 1',
            color: '#FF0000',
          },
          {
            id: 1,
            originalName: 'AOI2',
            displayedName: 'AOI 2',
            color: '#00FF00',
          },
        ],
        stimulusId: 1,
        applyTo: 'this_stimulus',
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return updateAois with empty list if no AOIs found for stimulus', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAois',
        aois: [],
        stimulusId: 999,
        applyTo: 'this_stimulus',
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateAois',
        aois: [],
        stimulusId: 999,
        applyTo: 'this_stimulus',
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })
  })

  describe('updateParticipants command reversal', () => {
    it('should reverse updateParticipants by restoring current participant data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipants',
        participants: [
          {
            id: 0,
            originalName: 'Participant1',
            displayedName: 'Participant 1',
          },
          {
            id: 1,
            originalName: 'Participant2',
            displayedName: 'Participant 2',
          },
        ],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return updateParticipants with empty list if no participants found', () => {
      // @ts-ignore
      mockEngine.metadata = {
        participants: { data: [], orderVector: [] },
        isOrdinalOnly: false,
        aois: {
          data: [],
          orderVector: [],
          dynamicVisibility: {},
          hiddenAois: [],
        },
        categories: { data: [], orderVector: [] },
        participantsGroups: [],
        stimuli: { data: [], orderVector: [] },
        noAoiTreatment: {
          displayedName: 'No AOI',
          color: '#CCCCCC',
        },
      }

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })
  })

  describe('updateStimuli command reversal', () => {
    it('should reverse updateStimuli by restoring current stimulus data', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateStimuli',
        stimuli: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateStimuli',
        stimuli: [
          { id: 0, originalName: 'Stimulus1', displayedName: 'Stimulus 1' },
          { id: 1, originalName: 'Stimulus2', displayedName: 'Stimulus 2' },
        ],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return updateStimuli with empty list if no stimuli found', () => {
      // @ts-ignore
      mockEngine.metadata = {
        stimuli: { data: [], orderVector: [] },
        isOrdinalOnly: false,
        aois: {
          data: [],
          orderVector: [],
          dynamicVisibility: {},
          hiddenAois: [],
        },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        participantsGroups: [],
        noAoiTreatment: {
          displayedName: 'No AOI',
          color: '#CCCCCC',
        },
      }

      const command: WorkspaceCommandChain = {
        type: 'updateStimuli',
        stimuli: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateStimuli',
        stimuli: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
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
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateAoiVisibility',
        stimulusId: 1,
        aoiNames: ['AOI 1', 'AOI 2'],
        visibilityArr: [
          [0, 100, 104, 120],
          [10, 20, 30, 40],
        ],
        participantId: 1,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return null if no visibility data found', () => {
      const command: WorkspaceCommandChain = {
        type: 'updateAoiVisibility',
        stimulusId: 999,
        aoiNames: ['AOI1'],
        visibilityArr: [[1, 0, 1]],
        participantId: 1,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
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
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipantsGroups',
        groups: [
          {
            id: 1,
            name: 'Group 1',
            participantIds: [1, 2],
          },
        ],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should return updateParticipantsGroups with empty list if no groups found', () => {
      // @ts-ignore
      mockEngine.metadata = {
        participantsGroups: [],
        isOrdinalOnly: false,
        aois: {
          data: [],
          orderVector: [],
          dynamicVisibility: {},
          hiddenAois: [],
        },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        stimuli: { data: [], orderVector: [] },
        noAoiTreatment: {
          displayedName: 'No AOI',
          color: '#CCCCCC',
        },
      }

      const command: WorkspaceCommandChain = {
        type: 'updateParticipantsGroups',
        groups: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipantsGroups',
        groups: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })
  })

  describe('error handling', () => {
    it('should return null for unknown command types', () => {
      const command = {
        type: 'unknownCommand',
        chainId: 1,
        isRootCommand: true,
      } as any

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })

    it('should handle errors gracefully and return null', () => {
      // Mock getData to throw an error
      // Mock getData to throw an error by using a getter if possible, or just fail naturally if not mocked as function
      // Since we replaced the mock with an object, we can't easily make property access throw.
      // However, we can simulate error conditions by setting invalid metadata or null.
      // The original test wanted to check error handling.
      // Let's assume the component under test handles null metadata gracefully or throws.
      // If we *must* have it throw on access, we can define a getter on the mock object.
      Object.defineProperty(mockEngine, 'metadata', {
        get: () => {
          throw new Error('Data store error')
        },
        configurable: true,
      })

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle empty data store gracefully', () => {
      // @ts-ignore
      mockEngine.metadata = {
        isOrdinalOnly: false,
        aois: {
          data: [],
          orderVector: [],
          dynamicVisibility: {},
          hiddenAois: [],
        },
        categories: { data: [], orderVector: [] },
        participants: { data: [], orderVector: [] },
        participantsGroups: [],
        stimuli: { data: [], orderVector: [] },
        noAoiTreatment: {
          displayedName: 'No AOI',
          color: '#CCCCCC',
        },
      }

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toEqual({
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      })
    })

    it('should handle null data store gracefully', () => {
      // @ts-ignore
      mockEngine.metadata = null

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result = reverseCommand(command)

      expect(result).toBeNull()
    })

    it('should handle undefined data store gracefully', () => {
      // @ts-ignore
      mockEngine.metadata = undefined

      const command: WorkspaceCommandChain = {
        type: 'updateParticipants',
        participants: [],
        source: 'source',
        chainId: 1,
        isRootCommand: true,
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
        settings: { timeline: 'relative' },
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const originalCommand = JSON.parse(JSON.stringify(command))

      reverseCommand(command)

      expect(command).toEqual(originalCommand)
    })

    it('should return consistent results for the same input', () => {
      const command: WorkspaceCommandChain = {
        type: 'removeGridItem',
        itemId: 1,
        source: 'source',
        chainId: 1,
        isRootCommand: true,
      }

      const result1 = reverseCommand(command)
      const result2 = reverseCommand(command)

      expect(result1).toEqual(result2)
    })
  })
})
