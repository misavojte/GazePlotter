import { beforeEach, describe, expect, it } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'
import {
  createChainedCommand,
  createEmptyMockMetadata,
  createMockEngine,
  createMockGridStore,
  setMockEngineMetadata,
  type MockEngine,
} from './helpers/workspaceCommandFixtures'

describe('workspaceCommandReverse metadata commands', () => {
  let mockGridStore: GridState
  let mockEngine: MockEngine
  let reverseCommand: (
    command: WorkspaceCommandChain
  ) => WorkspaceCommandChain | null

  beforeEach(() => {
    mockEngine = createMockEngine()
    mockGridStore = createMockGridStore()
    reverseCommand = createWorkspaceCommandRegistry(
      mockGridStore,
      mockEngine
    ).reverse
  })

  it.each([
    {
      label: 'updateAois',
      command: createChainedCommand({
        type: 'updateAois',
        aois: [],
        stimulusId: 1,
        applyTo: 'this_stimulus',
      }),
      expected: createChainedCommand({
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
      }),
    },
    {
      label: 'updateParticipants',
      command: createChainedCommand({
        type: 'updateParticipants',
        participants: [],
      }),
      expected: createChainedCommand({
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
      }),
    },
    {
      label: 'updateStimuli',
      command: createChainedCommand({
        type: 'updateStimuli',
        stimuli: [],
      }),
      expected: createChainedCommand({
        type: 'updateStimuli',
        stimuli: [
          { id: 0, originalName: 'Stimulus1', displayedName: 'Stimulus 1' },
          { id: 1, originalName: 'Stimulus2', displayedName: 'Stimulus 2' },
        ],
      }),
    },
    {
      label: 'updateParticipantsGroups',
      command: createChainedCommand({
        type: 'updateParticipantsGroups',
        groups: [],
      }),
      expected: createChainedCommand({
        type: 'updateParticipantsGroups',
        groups: [
          {
            id: 1,
            name: 'Group 1',
            participantsIds: [1, 2],
          },
        ],
      }),
    },
  ])('reverses $label using the current metadata snapshot', ({ command, expected }) => {
    expect(reverseCommand(command)).toEqual(expected)
  })

  it('returns an empty AOI list when the target stimulus has no AOIs', () => {
    expect(
      reverseCommand(
        createChainedCommand({
          type: 'updateAois',
          aois: [],
          stimulusId: 999,
          applyTo: 'this_stimulus',
        })
      )
    ).toEqual(
      createChainedCommand({
        type: 'updateAois',
        aois: [],
        stimulusId: 999,
        applyTo: 'this_stimulus',
      })
    )
  })

  it.each([
    {
      label: 'participants',
      command: createChainedCommand({
        type: 'updateParticipants',
        participants: [],
      }),
      expected: createChainedCommand({
        type: 'updateParticipants',
        participants: [],
      }),
    },
    {
      label: 'stimuli',
      command: createChainedCommand({
        type: 'updateStimuli',
        stimuli: [],
      }),
      expected: createChainedCommand({
        type: 'updateStimuli',
        stimuli: [],
      }),
    },
    {
      label: 'participant groups',
      command: createChainedCommand({
        type: 'updateParticipantsGroups',
        groups: [],
      }),
      expected: createChainedCommand({
        type: 'updateParticipantsGroups',
        groups: [],
      }),
    },
  ])('returns an empty list for $label when metadata is empty', ({ command, expected }) => {
    setMockEngineMetadata(mockEngine, createEmptyMockMetadata())

    expect(reverseCommand(command)).toEqual(expected)
  })

  it.each([null, undefined] as const)(
    'returns null for updateParticipants when metadata is %s',
    metadata => {
      setMockEngineMetadata(mockEngine, metadata)

      expect(
        reverseCommand(
          createChainedCommand({
            type: 'updateParticipants',
            participants: [],
          })
        )
      ).toBeNull()
    }
  )
})
