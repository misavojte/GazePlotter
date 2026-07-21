/**
 * Legacy hidden-visibility sets → named SELECTIONS migration.
 *
 * The retired mechanism (hiddenAois / hiddenChannels / hiddenCategories)
 * silently narrowed every plot; its removal must NOT change what an already
 * created workspace renders. The migration converts each affected stimulus's
 * hidden set into a keep-list selection (stimuli with identical keep-lists
 * share one), applies it to every existing plot showing that stimulus, and
 * consumes the legacy fields so the pass is idempotent.
 */
import { describe, expect, it } from 'vitest'
import { runMigrations as runMigrationsTyped } from '../src/lib/data/ingest/workspace/migrations'
const runMigrations = runMigrationsTyped as (parsedJson: unknown) => any

function buildFile(
  data: Record<string, unknown>,
  gridItems: unknown[] = []
): Record<string, unknown> {
  return {
    version: 5,
    data: {
      stimuli: {
        data: [
          ['S1', 'Stim One'],
          ['S2', 'Stim Two'],
        ],
        orderVector: [0, 1],
      },
      participants: { data: [['P1']], orderVector: [0] },
      participantsSelections: [],
      categories: { data: [['Fixation', 'Fixation', '#000']], orderVector: [0] },
      capabilities: { segmented: true, spatial: false, event: false },
      noAoiTreatment: { color: '#cbd5e1', displayedName: 'No AOI' },
      isOrdinalOnly: false,
      metricInstances: [],
      aois: { data: [[], []], orderVector: [[], []] },
      ...data,
    },
    gridItems,
    fileMetadata: null,
  }
}

const plot = (id: string, type: string, settings: Record<string, unknown>) => ({
  id,
  type,
  x: 0,
  y: 0,
  w: 8,
  h: 8,
  settings,
})

const THREE_AOIS = [
  ['A', 'A', '#1'],
  ['B', 'B', '#2'],
  ['C', 'C', '#3'],
]

describe('legacy hidden AOIs → aois.selections', () => {
  it('stimuli with the same keep-list share one selection, applied per plot stimulus', () => {
    const file = buildFile(
      {
        aois: {
          data: [THREE_AOIS, THREE_AOIS],
          orderVector: [[0, 1, 2], [0, 1, 2]],
          hiddenAois: [[2], [2]],
          // Pre-existing user selection — ids must allocate above it.
          selections: [{ id: 5, name: 'Mine', names: ['C'] }],
        },
      },
      [
        plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 }),
        plot('bar-1', 'barPlot', { stimulusId: 1, groupId: -1 }),
        // Unsupported type: no aoiSelectionId key exists — left untouched.
        plot('sp-1', 'scanpath', { stimulusId: 0, groupId: -1 }),
        // Explicit user pick predates the migration — left untouched.
        plot('bar-2', 'barPlot', { stimulusId: 0, groupId: -1, aoiSelectionId: 5 }),
      ]
    )
    const m = runMigrations(file)

    expect(m.data.aois.hiddenAois).toBeUndefined()
    expect(m.data.aois.selections).toEqual([
      { id: 5, name: 'Mine', names: ['C'] },
      { id: 6, name: 'Migrated visibility', names: ['A', 'B'] },
    ])
    const byId = Object.fromEntries(m.gridItems.map((g: any) => [g.id, g.settings]))
    expect(byId['scarf-1'].aoiSelectionId).toBe(6)
    expect(byId['bar-1'].aoiSelectionId).toBe(6)
    expect('aoiSelectionId' in byId['sp-1']).toBe(false)
    expect(byId['bar-2'].aoiSelectionId).toBe(5)
  })

  it('distinct keep-lists become distinct selections named by stimulus', () => {
    const file = buildFile(
      {
        aois: {
          data: [THREE_AOIS, THREE_AOIS],
          orderVector: [[0, 1, 2], [0, 1, 2]],
          hiddenAois: [[0], [2]],
        },
      },
      [
        plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 }),
        plot('scarf-2', 'scarf', { stimulusId: 1, groupId: -1 }),
      ]
    )
    const m = runMigrations(file)

    expect(m.data.aois.selections).toEqual([
      { id: 1, name: 'Migrated visibility (Stim One)', names: ['B', 'C'] },
      { id: 2, name: 'Migrated visibility (Stim Two)', names: ['A', 'B'] },
    ])
    const byId = Object.fromEntries(m.gridItems.map((g: any) => [g.id, g.settings]))
    expect(byId['scarf-1'].aoiSelectionId).toBe(1)
    expect(byId['scarf-2'].aoiSelectionId).toBe(2)
  })

  it('keep-list follows the display order and dedupes merged (same-name) entities', () => {
    const file = buildFile({
      aois: {
        data: [
          [
            ['x', 'Shared', '#1'],
            ['y', 'Shared', '#2'],
            ['z', 'Solo', '#3'],
          ],
          [],
        ],
        orderVector: [[2, 0, 1], []],
        hiddenAois: [[1], []],
      },
    })
    const m = runMigrations(file)
    expect(m.data.aois.selections).toEqual([
      { id: 1, name: 'Migrated visibility', names: ['Solo', 'Shared'] },
    ])
  })

  it('stale hidden ids (no matching entity) create nothing; the field is still consumed', () => {
    const file = buildFile(
      {
        aois: {
          data: [[['A', 'A', '#1']], []],
          orderVector: [[0], []],
          hiddenAois: [[5], []],
        },
      },
      [plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 })]
    )
    const m = runMigrations(file)
    expect(m.data.aois.hiddenAois).toBeUndefined()
    expect(m.data.aois.selections).toBeUndefined()
    expect(m.gridItems[0].settings.aoiSelectionId).toBeUndefined()
  })
})

describe('legacy hidden event channels → eventsSelections', () => {
  it('creates the keep-list selection and stamps scarf plots on the affected stimulus', () => {
    const file = buildFile(
      {
        eventData: {
          data: [
            [
              ['click', 'Click', '#1'],
              ['blink', 'Blink', '#2'],
            ],
            [],
          ],
          orderVector: [[0, 1], []],
          hiddenChannels: [[1], []],
          events: [[], []],
        },
      },
      [
        plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 }),
        plot('scarf-2', 'scarf', { stimulusId: 1, groupId: -1 }),
      ]
    )
    const m = runMigrations(file)

    expect(m.data.eventData.hiddenChannels).toBeUndefined()
    expect(m.data.eventsSelections).toEqual([
      { id: 1, name: 'Migrated visibility', names: ['Click'] },
    ])
    const byId = Object.fromEntries(m.gridItems.map((g: any) => [g.id, g.settings]))
    expect(byId['scarf-1'].eventSelectionId).toBe(1)
    // Stimulus 1 hid nothing — its plot stays on "All".
    expect(byId['scarf-2'].eventSelectionId).toBeUndefined()
  })
})

describe('legacy hidden categories → categoriesSelections (global)', () => {
  it('creates one id-keyed selection (fixation excluded) applied to every scarf', () => {
    const file = buildFile(
      {
        categories: {
          data: [
            ['Fixation', 'Fixation', '#000'],
            ['Saccade', 'Saccade', '#111'],
            ['Blink', 'Blink', '#222'],
          ],
          orderVector: [0, 1, 2],
          // 0 (fixation) and 9 (stale) must be ignored; only 2 counts.
          hiddenCategories: [0, 2, 9],
        },
      },
      [
        plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 }),
        plot('scarf-2', 'scarf', { stimulusId: 1, groupId: -1 }),
      ]
    )
    const m = runMigrations(file)

    expect(m.data.categories.hiddenCategories).toBeUndefined()
    expect(m.data.categoriesSelections).toEqual([
      { id: 1, name: 'Migrated visibility', memberIds: [1] },
    ])
    // Hidden categories were global — every scarf gets the selection.
    const byId = Object.fromEntries(m.gridItems.map((g: any) => [g.id, g.settings]))
    expect(byId['scarf-1'].categorySelectionId).toBe(1)
    expect(byId['scarf-2'].categorySelectionId).toBe(1)
  })
})

describe('migration hygiene', () => {
  it('is idempotent — the legacy fields are consumed on the first pass', () => {
    const file = buildFile(
      {
        aois: {
          data: [THREE_AOIS, []],
          orderVector: [[0, 1, 2], []],
          hiddenAois: [[2], []],
        },
      },
      [plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 })]
    )
    const once = runMigrations(file)
    const twice = runMigrations(JSON.parse(JSON.stringify(once)))
    expect(twice.data.aois.selections).toEqual(once.data.aois.selections)
    expect(twice.gridItems).toEqual(once.gridItems)
  })

  it('leaves files without legacy fields completely untouched', () => {
    const file = buildFile(
      {
        aois: {
          data: [THREE_AOIS, []],
          orderVector: [[0, 1, 2], []],
          selections: [{ id: 3, name: 'Mine', names: ['A'] }],
        },
      },
      [plot('scarf-1', 'scarf', { stimulusId: 0, groupId: -1 })]
    )
    const m = runMigrations(file)
    expect(m.data.aois.selections).toEqual([{ id: 3, name: 'Mine', names: ['A'] }])
    expect(m.data.eventsSelections).toBeUndefined()
    expect(m.data.categoriesSelections).toBeUndefined()
    expect(m.gridItems[0].settings.aoiSelectionId).toBeUndefined()
  })
})
