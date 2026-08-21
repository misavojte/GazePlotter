import { vi } from 'vitest'
import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { EventBufferReader } from '$lib/data/binary'
import type {
  DataType,
  NoAoiTreatmentType,
  ParticipantsSelection,
} from '$lib/data/types'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { MetricInstance } from '$lib/metrics'
import type { GridState } from '$lib/workspace/grid'
import type { AllGridTypes, GridItemMap } from '$lib/workspace'
import { createGridItem } from '$lib/workspace/grid/itemFactory'
import type { ScarfPlotSettings } from '$lib/plots/scarf/types'
import type { AoiComparisonSettings } from '$lib/plots/aoi-comparison/types'

export type MockMetadata = Omit<DataType, 'segments' | 'participantsSelections'> & {
  participantsSelections: ParticipantsSelection[]
}

export type MockEngine = DataEngine & {
  metadata: MockMetadata | null | undefined
}

type GridStoreMock = Partial<GridState> & Pick<GridState, 'items'>
type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T

export function createMockMetadata(
  overrides: Partial<MockMetadata> = {}
): MockMetadata {
  return {
    aois: {
      data: [
        [],
        [
          ['AOI1', 'AOI 1', '#FF0000', '0,0,100,100'],
          ['AOI2', 'AOI 2', '#00FF00', '100,100,200,200'],
        ],
      ],
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
    participantsSelections: [
      {
        id: 1,
        name: 'Group 1',
        participantsIds: [1, 2],
      },
    ],
    metricInstances: [],
    noAoiTreatment: createNoAoiTreatment(),
    isOrdinalOnly: false,
    capabilities: {
      segmented: true,
      spatial: false,
      event: false,
    },
    eventData: {
      data: [[], []],
      orderVector: [],
      events: [[], []],
    },
    ...overrides,
  }
}

export function createEmptyMockMetadata(
  overrides: Partial<MockMetadata> = {}
): MockMetadata {
  return createMockMetadata({
    aois: {
      data: [],
      orderVector: [],
    },
    participants: {
      data: [],
      orderVector: [],
    },
    stimuli: {
      data: [],
      orderVector: [],
    },
    categories: {
      data: [],
      orderVector: [],
    },
    participantsSelections: [],
    ...overrides,
  })
}

export function createMockEngine(
  metadata: MockMetadata | null | undefined = createMockMetadata()
): MockEngine {
  const engine = { metadata: null } as unknown as MockEngine
  setMockEngineMetadata(engine, metadata)
  return engine
}

export function setMockEngineMetadata(
  engine: MockEngine,
  metadata: MockMetadata | null | undefined
): void {
  Object.defineProperty(engine, 'metadata', {
    value: metadata,
    writable: true,
    configurable: true,
  })
  // Occurrence buffers live in the engine's binary reader, not metadata —
  // mirror the production split so reader-backed reads (command inverses,
  // selectors) work against the mock.
  const reader = new EventBufferReader()
  reader.load(metadata?.eventData?.events ?? [])
  Object.defineProperty(engine, 'getEventReader', {
    value: () => reader,
    writable: true,
    configurable: true,
  })
  // Mirror the production mutator the `updateMetricInstances` handler calls.
  Object.defineProperty(engine, 'setMetricInstances', {
    value: (instances: MetricInstance[]) => {
      if (engine.metadata) engine.metadata.metricInstances = instances
    },
    writable: true,
    configurable: true,
  })
}

export function createMockGridStore(
  items: AllGridTypes[] = createDefaultGridItems()
): GridState {
  const gridStore: GridStoreMock = {
    items,
    triggerRedraw: vi.fn(),
    reset: vi.fn(),
    updateSettings: vi.fn(),
    updateLayout: vi.fn(),
    removeItem: vi.fn(),
    duplicateItem: vi.fn(),
    addItem: vi.fn(),
    resolveItemPositionCollisions: vi.fn(() => []),
  }

  return gridStore as GridState
}

/**
 * Grid items built by the PRODUCTION factory, so fixture items always carry
 * the plot definitions' current default settings (hand-copied defaults here
 * had already drifted). Only test-owned bits are pinned: compact geometry,
 * stable ids, a deterministic redrawTimestamp, and stimulusId 1 (where
 * createMockMetadata puts its AOIs).
 */
export function createScarfGridItem(
  overrides: Partial<Omit<GridItemMap['scarf'], 'settings'>> & {
    settings?: Partial<ScarfPlotSettings>
  } = {}
): GridItemMap['scarf'] {
  const { settings, redrawTimestamp, ...itemOverrides } = overrides
  const item = createGridItem('scarf', {
    type: 'scarf',
    id: 1,
    x: 0,
    y: 0,
    w: 6,
    h: 8,
    min: { w: 4, h: 4 },
    ...itemOverrides,
    settings: { stimulusId: 1, ...settings },
  }) as GridItemMap['scarf']
  item.redrawTimestamp = redrawTimestamp ?? 1
  return item
}

/** See {@link createScarfGridItem}. */
export function createAoiComparisonGridItem(
  overrides: Partial<Omit<GridItemMap['aoiComparison'], 'settings'>> & {
    settings?: Partial<AoiComparisonSettings>
  } = {}
): GridItemMap['aoiComparison'] {
  const { settings, redrawTimestamp, ...itemOverrides } = overrides
  const item = createGridItem('aoiComparison', {
    type: 'aoiComparison',
    id: 2,
    x: 6,
    y: 0,
    w: 6,
    h: 8,
    min: { w: 4, h: 4 },
    ...itemOverrides,
    settings: { stimulusId: 1, ...settings },
  }) as GridItemMap['aoiComparison']
  item.redrawTimestamp = redrawTimestamp ?? 1
  return item
}

export function createDefaultGridItems(): AllGridTypes[] {
  return [createScarfGridItem(), createAoiComparisonGridItem()]
}

export function createChainedCommand<const TCommand extends { type: string }>(
  command: TCommand,
  overrides: Partial<
    Pick<WorkspaceCommandChain, 'source' | 'chainId' | 'isRootCommand'>
  > = {}
): Mutable<TCommand> &
  Pick<WorkspaceCommandChain, 'source' | 'chainId' | 'isRootCommand'> {
  return {
    ...command,
    source: overrides.source ?? 'source',
    chainId: overrides.chainId ?? 1,
    isRootCommand: overrides.isRootCommand ?? true,
  } as Mutable<TCommand> &
    Pick<WorkspaceCommandChain, 'source' | 'chainId' | 'isRootCommand'>
}

function createNoAoiTreatment(): NoAoiTreatmentType {
  return {
    displayedName: 'No AOI',
    color: '#CCCCCC',
  }
}
