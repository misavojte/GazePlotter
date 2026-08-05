import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DataEngine } from '../src/lib/data/engine/dataEngine.svelte'
import { WorkspaceCommandBus } from '../src/lib/workspace/commands/bus'
import { createWorkspaceCommandRegistry } from '../src/lib/workspace/commands/registry'
import { getParticipantsWithMerged, getStimuliWithMerged } from '../src/lib/data/engine'
import type { WorkspaceCommandChain } from '../src/lib/workspace/commands'
import type { BaseInterpretedDataType, DataType } from '../src/lib/data/types'
import { createMockGridStore, createChainedCommand } from './helpers/workspaceCommandFixtures'
import { makeDataType, engineNestedSegments as nested } from './helpers/dataTypeFixtures'

// ============================================================================
// Shared Test Fixtures & Helpers
// ============================================================================
const execCtx = { isUndoRedoOperation: false, dispatch: () => {} }

const makeParticipantData = (): DataType =>
  makeDataType(
    // Disjoint: p0 on stim1, p1 on stim0.
    [
      [[], [[0, 100, 0, 0]], [[0, 50, 0]]],
      [[[200, 300, 0, 0]], [], [[10, 20, 0]]],
    ],
    {
      participants: {
        data: [['P0', 'P0'], ['P1', 'P1 (copy)'], ['P2', 'P2']],
        orderVector: [0, 1, 2],
      },
      participantsSelections: [{ id: 1, name: 'G', participantsIds: [1, 2] }],
    }
  )

// Stimulus-disjoint fixture: p0 only on S0, p1 only on S1, so S0 and S1 can
// merge. Both stimuli carry an AOI named 'A' (the fixture default), exercising
// the M4 dictionary reconciliation.
const makeStimulusData = (): DataType =>
  makeDataType(
    [
      [[[0, 100, 0, 0]], []],
      [[], [[200, 300, 0, 0]]],
    ],
    {
      stimuli: { data: [['S0', 'S0'], ['S1', 'S1 (copy)']], orderVector: [0, 1] },
    }
  )

const makeService = (engine: DataEngine) =>
  new WorkspaceCommandBus({
    engine,
    errorService: { report: vi.fn() },
    grid: createMockGridStore([]),
    toastState: { addSuccess: vi.fn() },
  })

const withName = (
  rows: BaseInterpretedDataType[],
  id: number,
  displayedName: string
): BaseInterpretedDataType[] =>
  rows.map(r => (r.id === id ? { ...r, displayedName } : r))

// ============================================================================
// 1. mergeEntities & unmergeEntities Command Suite (from mergeCommand.test.ts)
// ============================================================================
describe('mergeEntities commands (through a real DataEngine)', () => {
  let engine: DataEngine
  let registry: ReturnType<typeof createWorkspaceCommandRegistry>

  describe('Participant axis merges', () => {
    beforeEach(() => {
      engine = new DataEngine()
      engine.loadDataset(makeParticipantData())
      registry = createWorkspaceCommandRegistry(createMockGridStore(), engine)
    })

    it("reverse precomputes the exact un-merge before execute", () => {
      const cmd = createChainedCommand({
        type: 'mergeEntities',
        axis: 'participant',
        representativeId: 0,
        memberIds: [1],
        at: 7,
      }) as WorkspaceCommandChain

      const reverse = registry.reverse(cmd)
      expect(reverse?.type).toBe('unmergeEntities')
      expect(engine.metadata!.participants.orderVector).toEqual([0, 1, 2])
    })

    it('forward merges; undo restores; redo re-applies (symmetric)', () => {
      const forward = createChainedCommand({
        type: 'mergeEntities',
        axis: 'participant',
        representativeId: 0,
        memberIds: [1],
        at: 7,
      }) as WorkspaceCommandChain

      const beforeSegments = nested(engine)

      const inverse = registry.reverse(forward)!
      registry.execute(forward, execCtx)

      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])
      expect(engine.metadata!.participantsSelections[0].participantsIds).toEqual([0, 2])
      expect(engine.metadata!.merges).toHaveLength(1)
      expect(nested(engine)[0][0]).toEqual([[0, 100, 0, 0]])
      expect(nested(engine)[0][1]).toEqual([])

      registry.execute(inverse, execCtx)
      expect(engine.metadata!.participants.orderVector).toEqual([0, 1, 2])
      expect(engine.metadata!.participantsSelections[0].participantsIds).toEqual([1, 2])
      expect(engine.metadata!.merges ?? []).toHaveLength(0)
      expect(nested(engine)).toEqual(beforeSegments)

      const redo = registry.reverse(inverse)!
      expect(redo.type).toBe('mergeEntities')
      registry.execute(redo, execCtx)
      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])
      expect(nested(engine)[0][0]).toEqual([[0, 100, 0, 0]])
    })
  })

  describe('Stimulus axis merges', () => {
    beforeEach(() => {
      engine = new DataEngine()
      engine.loadDataset(makeStimulusData())
      registry = createWorkspaceCommandRegistry(createMockGridStore(), engine)
    })

    it('reverse precomputes the exact un-merge (stimulus axis) before execute', () => {
      const cmd = createChainedCommand({
        type: 'mergeEntities',
        axis: 'stimulus',
        representativeId: 0,
        memberIds: [1],
        at: 7,
      }) as WorkspaceCommandChain

      const reverse = registry.reverse(cmd)
      expect(reverse?.type).toBe('unmergeEntities')
      expect(engine.metadata!.stimuli.orderVector).toEqual([0, 1])
    })

    it('forward merges stimuli; undo restores; redo re-applies (symmetric)', () => {
      const forward = createChainedCommand({
        type: 'mergeEntities',
        axis: 'stimulus',
        representativeId: 0,
        memberIds: [1],
        at: 7,
      }) as WorkspaceCommandChain

      const beforeSegments = nested(engine)

      const inverse = registry.reverse(forward)!
      expect(inverse.type).toBe('unmergeEntities')
      registry.execute(forward, execCtx)

      expect(engine.metadata!.stimuli.orderVector).toEqual([0])
      expect(engine.metadata!.merges).toHaveLength(1)
      expect(engine.metadata!.merges![0].axis).toBe('stimulus')
      expect(nested(engine)[0][0]).toEqual([[0, 100, 0, 0]])
      expect(nested(engine)[0][1]).toEqual([[200, 300, 0, 0]])

      registry.execute(inverse, execCtx)
      expect(engine.metadata!.stimuli.orderVector).toEqual([0, 1])
      expect(engine.metadata!.merges ?? []).toHaveLength(0)
      expect(nested(engine)).toEqual(beforeSegments)

      const redo = registry.reverse(inverse)!
      expect(redo.type).toBe('mergeEntities')
      registry.execute(redo, execCtx)
      expect(engine.metadata!.stimuli.orderVector).toEqual([0])
      expect(nested(engine)[0][1]).toEqual([[200, 300, 0, 0]])
    })
  })
})

// ============================================================================
// 2. reconcileMerges Orchestrator Suite (from reconcileMergesCommand.test.ts)
// ============================================================================
describe('reconcileMerges through the command bus', () => {
  let engine: DataEngine
  let ws: WorkspaceCommandBus

  describe('Participant axis reconciliation', () => {
    beforeEach(() => {
      engine = new DataEngine()
      engine.loadDataset(makeParticipantData())
      ws = makeService(engine)
    })

    it('merges a newly-formed group and undoes/redoes it as ONE step', () => {
      const before = nested(engine)

      const items = withName(getParticipantsWithMerged(engine), 1, 'P0')
      ws.apply({
        type: 'reconcileMerges',
        axis: 'participant',
        items,
        groups: [{ representativeId: 0, memberIds: [1], at: 100 }],
        source: 'test.modal',
      })

      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])
      expect(engine.metadata!.participantsSelections[0].participantsIds).toEqual([0, 2])
      expect(engine.metadata!.merges).toHaveLength(1)
      expect(nested(engine)[0][0]).toEqual([[0, 100, 0, 0]])

      expect(ws.history.undoStack).toHaveLength(1)
      ws.undo()
      expect(engine.metadata!.participants.orderVector).toEqual([0, 1, 2])
      expect(engine.metadata!.participantsSelections[0].participantsIds).toEqual([1, 2])
      expect(engine.metadata!.merges ?? []).toHaveLength(0)
      expect(engine.metadata!.participants.data[1][1]).toBe('P1 (copy)')
      expect(nested(engine)).toEqual(before)

      ws.redo()
      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])
      expect(engine.metadata!.merges).toHaveLength(1)
      expect(nested(engine)[0][0]).toEqual([[0, 100, 0, 0]])
    })

    it('un-merges by renaming a merged member apart, atomically', () => {
      const before = nested(engine)

      engine.mergeEntities('participant', 0, [1], 7)
      ws = makeService(engine)
      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])

      const merged = getParticipantsWithMerged(engine)
      expect(merged.map(r => r.id)).toEqual([0, 1, 2])
      expect(merged.find(r => r.id === 1)!.displayedName).toBe('P0')

      const items = withName(merged, 1, 'P1 restored')
      ws.apply({
        type: 'reconcileMerges',
        axis: 'participant',
        items,
        groups: [],
        source: 'test.modal',
      })

      expect(engine.metadata!.participants.orderVector).toEqual([0, 1, 2])
      expect(engine.metadata!.merges ?? []).toHaveLength(0)
      expect(engine.metadata!.participants.data[1][1]).toBe('P1 restored')
      expect(engine.metadata!.participantsSelections[0].participantsIds).toEqual([1, 2])
      expect(nested(engine)).toEqual(before)

      expect(ws.history.undoStack).toHaveLength(1)
      ws.undo()
      expect(engine.metadata!.participants.orderVector).toEqual([0, 2])
      expect(engine.metadata!.merges).toHaveLength(1)
    })
  })

  describe('Stimulus axis reconciliation', () => {
    it('merges two stimuli and undoes it as ONE step', () => {
      engine = new DataEngine()
      engine.loadDataset(makeStimulusData())
      const before = nested(engine)
      ws = makeService(engine)

      const items = withName(getStimuliWithMerged(engine), 1, 'S0')
      ws.apply({
        type: 'reconcileMerges',
        axis: 'stimulus',
        items,
        groups: [{ representativeId: 0, memberIds: [1], at: 100 }],
        source: 'test.modal',
      })

      expect(engine.metadata!.stimuli.orderVector).toEqual([0])
      expect(engine.metadata!.merges).toHaveLength(1)
      expect(engine.metadata!.merges![0].axis).toBe('stimulus')

      expect(ws.history.undoStack).toHaveLength(1)
      ws.undo()
      expect(engine.metadata!.stimuli.orderVector).toEqual([0, 1])
      expect(engine.metadata!.merges ?? []).toHaveLength(0)
      expect(engine.metadata!.stimuli.data[1][1]).toBe('S1 (copy)')
      expect(nested(engine)).toEqual(before)
    })
  })
})
