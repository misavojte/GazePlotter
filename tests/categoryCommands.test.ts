import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceCommandRegistry } from '$lib/workspace/commands/registry'
import {
  createChainedCommand,
  createMockEngine,
  createMockGridStore,
} from './helpers/workspaceCommandFixtures'
import { groupCategoriesByDisplayedName } from '$lib/plots/scarf/core/transformer'

const engineMocks = vi.hoisted(() => ({
  updateCategories: vi.fn(),
  getDefaultCategoryColor: (index: number) => {
    const pal = ['#4a4a4a', '#737373', '#9c9c9c', '#c5c5c5']
    const palIndex = index > 0 ? index - 1 : 0
    return pal[palIndex % pal.length]
  }
}))

vi.mock('$lib/data/engine', () => ({
  ...engineMocks,
}))

describe('categoryCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes updateCategories command and triggers redraw', () => {
    const gridStore = createMockGridStore([])
    const dispatch = vi.fn()
    const command = createChainedCommand({
      type: 'updateCategories',
      categories: [
        { id: 1, originalName: 'Saccade', displayedName: 'Saccadic Movement', color: '#ff0000' }
      ],
      hiddenCategories: [2]
    }, {
      source: 'category.modal',
      chainId: 42,
    })

    createWorkspaceCommandRegistry(gridStore, createMockEngine()).execute(command, {
      isUndoRedoOperation: false,
      dispatch,
    })

    expect(engineMocks.updateCategories).toHaveBeenCalledWith(
      expect.anything(),
      [
        { id: 1, originalName: 'Saccade', displayedName: 'Saccadic Movement', color: '#ff0000' }
      ],
      [2]
    )
    expect(gridStore.triggerRedraw).toHaveBeenCalled()
  })

  it('reverses updateCategories command correctly', () => {
    const gridStore = createMockGridStore([])
    const engine = createMockEngine()
    engine.metadata = {
      categories: {
        data: [
          ['Fixation', 'Fixation', '#ffffff'],
          ['Saccade', 'Saccade', '#555555'],
          ['Blink', 'Blink', '#a6a6a6'],
        ],
        orderVector: [0, 1, 2],
        hiddenCategories: [2],
      }
    } as any

    const command = createChainedCommand({
      type: 'updateCategories',
      categories: [
        { id: 1, originalName: 'Saccade', displayedName: 'Saccadic Movement', color: '#ff0000' }
      ],
      hiddenCategories: [2]
    }, {
      source: 'category.modal',
      chainId: 42,
    })

    const reversed = createWorkspaceCommandRegistry(gridStore, engine).reverse(command)

    expect(reversed).not.toBeNull()
    expect(reversed?.type).toBe('updateCategories')
    if (reversed && reversed.type === 'updateCategories') {
      expect(reversed.categories).toEqual([
        { id: 0, originalName: 'Fixation', displayedName: 'Fixation', color: '#ffffff' },
        { id: 1, originalName: 'Saccade', displayedName: 'Saccade', color: '#555555' },
        { id: 2, originalName: 'Blink', displayedName: 'Blink', color: '#a6a6a6' },
      ])
      expect(reversed.hiddenCategories).toEqual([2])
    }
  })

  it('reverses updateCategories command correctly using default category colors when missing', () => {
    const gridStore = createMockGridStore([])
    const engine = createMockEngine()
    engine.metadata = {
      categories: {
        data: [
          ['Fixation', 'Fixation'],
          ['Saccade', 'Saccade'],
          ['Blink', 'Blink'],
        ],
        orderVector: [0, 1, 2],
        hiddenCategories: [2],
      }
    } as any

    const command = createChainedCommand({
      type: 'updateCategories',
      categories: [
        { id: 1, originalName: 'Saccade', displayedName: 'Saccadic Movement', color: '#ff0000' }
      ],
      hiddenCategories: [2]
    }, {
      source: 'category.modal',
      chainId: 42,
    })

    const reversed = createWorkspaceCommandRegistry(gridStore, engine).reverse(command)

    expect(reversed).not.toBeNull()
    expect(reversed?.type).toBe('updateCategories')
    if (reversed && reversed.type === 'updateCategories') {
      expect(reversed.categories).toEqual([
        { id: 0, originalName: 'Fixation', displayedName: 'Fixation', color: '#4a4a4a' },
        { id: 1, originalName: 'Saccade', displayedName: 'Saccade', color: '#4a4a4a' },
        { id: 2, originalName: 'Blink', displayedName: 'Blink', color: '#737373' },
      ])
      expect(reversed.hiddenCategories).toEqual([2])
    }
  })
})

describe('category grouping', () => {
  it('groups categories with the same displayed name', () => {
    const categories = [
      { id: 1, originalName: 'Saccade', displayedName: 'Saccadic Movement', color: '#ff0000' },
      { id: 2, originalName: 'Blink', displayedName: 'Saccadic Movement', color: '#00ff00' },
      { id: 3, originalName: 'EyesNotFound', displayedName: 'EyesNotFound', color: '#0000ff' },
    ]
    const grouped = groupCategoriesByDisplayedName(categories)
    expect(grouped.length).toBe(2)
    expect(grouped[0].displayedName).toBe('Saccadic Movement')
    expect(grouped[0].memberIds).toEqual([1, 2])
    expect(grouped[1].displayedName).toBe('EyesNotFound')
    expect(grouped[1].memberIds).toEqual([3])
  })
})
