import { vi } from 'vitest'
import type { DataEngine } from '$lib/data/engine/DataEngine.svelte'
import type {
  DataType,
  NoAoiTreatmentType,
  ParticipantsGroup,
} from '$lib/data/types'
import type { WorkspaceCommandChain } from '$lib/workspace/commands'
import type { GridState } from '$lib/workspace/grid'
import type { AllGridTypes } from '$lib/workspace'
import type { ScarfPlotItem, ScarfPlotSettings } from '$lib/plots/scarf/types'
import type { BarPlotItem, BarPlotSettings } from '$lib/plots/bar/types'

export type MockMetadata = Omit<DataType, 'segments' | 'participantsGroups'> & {
  participantsGroups: ParticipantsGroup[]
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
      hiddenChannels: [],
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
      hiddenAois: [],
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
    participantsGroups: [],
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
    setLayoutState: vi.fn(),
    updateItem: vi.fn(),
  }

  return gridStore as GridState
}

export function createScarfGridItem(
  overrides: Partial<Omit<ScarfPlotItem, 'settings'>> & {
    settings?: Partial<ScarfPlotSettings>
  } = {}
): ScarfPlotItem {
  const { settings: settingsOverrides, ...itemOverrides } = overrides
  const settings: ScarfPlotSettings = {
    stimulusId: 1,
    groupId: -1,
    timeline: 'absolute',
    absoluteStimuliLimits: [],
    ordinalStimuliLimits: [],
    dynamicAOI: true,
  }
  Object.assign(settings, settingsOverrides)

  return {
    id: 1,
    type: 'scarf',
    x: 0,
    y: 0,
    w: 6,
    h: 8,
    min: { w: 4, h: 4 },
    redrawTimestamp: 1,
    ...itemOverrides,
    settings,
  }
}

export function createBarPlotGridItem(
  overrides: Partial<Omit<BarPlotItem, 'settings'>> & {
    settings?: Partial<BarPlotSettings>
  } = {}
): BarPlotItem {
  const { settings: settingsOverrides, ...itemOverrides } = overrides
  const settings: BarPlotSettings = {
    stimulusId: 1,
    groupId: -1,
    barPlottingType: 'horizontal',
    orderBy: 'aoi',
    orderDirection: 'asc',
    metricInstanceId: 1,
    scaleRange: [0, 0],
    statisticalOverlay: 'none',
  }
  Object.assign(settings, settingsOverrides)

  return {
    id: 2,
    type: 'barPlot',
    x: 6,
    y: 0,
    w: 6,
    h: 8,
    min: { w: 4, h: 4 },
    redrawTimestamp: 1,
    ...itemOverrides,
    settings,
  }
}

export function createDefaultGridItems(): AllGridTypes[] {
  return [createScarfGridItem(), createBarPlotGridItem()]
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
