/**
 * Equivalence pin for the KEEP-IN-SYNC invariant between the two builders of
 * "the categorical AOI fixation sequence":
 *
 *   - `extractFixationSequence` (metrics/core/fixations.ts) — consumer-facing,
 *     used by evolving-metrics to resolve window indices back to milliseconds;
 *   - the RQA recipes' `onFixation` gate, driven through the REAL runtime scan
 *     (`scanAccumulator`, metrics/core/runtime.ts) — the accumulator whose
 *     window indices those milliseconds must describe.
 *
 * Both carry comments demanding index alignment ("Must stay index-aligned…",
 * "…matching extractFixationSequence"); this test is the enforcement. If the
 * two ever disagree — on the single-AOI gate, the same-slot dedup (a fixation
 * tagged by multiple raw ids that MERGE to one displayed AOI counts as
 * single-AOI), hidden-AOI filtering, or the include_no_aoi sentinel — windowed
 * RQA in evolving-metrics silently mislabels its time axis.
 *
 * Fixture semantics (raw AOI ids index `aois.data[stimulus]`):
 *   raw 1 'AOI 1', raw 2 'AOI 2', raw 3 displayed-name-merged into 'AOI 1',
 *   raw 4 hidden. Visible slots: 'AOI 1' → 0, 'AOI 2' → 1, noAoiSlot = 2.
 */

import { describe, it, expect } from 'vitest'
import { makeTestEngine } from './helpers/testEngine'
import { extractFixationSequence, type MetricInstance } from '../src/lib/metrics'
import { getRecipe } from '../src/lib/metrics/core/defineMetric'
import { scanAccumulator } from '../src/lib/metrics/core/runtime'

const STIM = 1

// AOI 4 is narrowed away by the SELECTION below — the alignment must hold for
// the reduced alphabet a per-plot AOI SELECTION produces.
const SELECTION_ID = 1

function makeEngine(perParticipantSegments: number[][][]) {
  return makeTestEngine([[], perParticipantSegments], {
    aoiData: [
      [],
      [
        null,
        ['AOI 1', 'AOI 1', 'red'],
        ['AOI 2', 'AOI 2', 'blue'],
        ['AOI 3', 'AOI 1', 'green'], // displayed-name merge → same entity as raw 1
        ['AOI 4', 'AOI 4', 'gray'], // outside the selection below
      ],
    ],
    aoiOrderVector: [[], [1, 2, 3, 4]],
    aoiSelections: [{ id: SELECTION_ID, name: 'Focus', names: ['AOI 1', 'AOI 2'] }],
    aoiMapping: 'group',
  })
}

function inst(baseId: string, params: Record<string, unknown>): MetricInstance {
  return {
    id: 't1',
    baseId,
    params,
    label: '',
    projection: { kind: 'identity-scalar' },
  }
}

/**
 * One participant exercising every gate the invariant covers.
 * Row = [start, end, category, ...rawAoiIds]; category 0 = fixation.
 */
const SEGMENTS = [
  [0, 50, 0, 1], //      single AOI (slot 0)        → in seq
  [60, 90, 1, 2], //     saccade                    → ignored by both
  [100, 150, 0, 1, 3], // two raws, ONE merged slot → dedup → in seq (slot 0)
  [200, 250, 0, 1, 2], // two distinct slots        → dropped by both
  [300, 350, 0], //      zero AOIs                  → sentinel iff includeNoAoi
  [400, 450, 0, 4], //   only out-of-selection AOI  → resolves empty, like zero
  [500, 550, 0, 2], //   single AOI (slot 1)        → in seq
  [600, 650, 0, 4, 2], // out-of-selection + kept   → dedup → in seq (slot 1)
]

const A = 0 // slot of 'AOI 1'
const B = 1 // slot of 'AOI 2'
const N = 2 // noAoiSlot (2 selected AOIs)

function recipeSeq(
  engine: ReturnType<typeof makeEngine>,
  baseId: string,
  params: Record<string, unknown>,
  timeStart = 0,
  timeEnd = 0
): number[] {
  const recipe = getRecipe(baseId)
  expect(recipe).toBeDefined()
  const out = scanAccumulator(
    recipe!,
    inst(baseId, params),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { engine: engine as any, stimulusId: STIM, participantId: 0, aoiSelectionId: SELECTION_ID },
    timeStart,
    timeEnd
  )
  expect(out).not.toBeNull()
  return (out!.acc as { seq: number[] }).seq
}

describe('extractFixationSequence == RQA recipe onFixation through the real scan', () => {
  const engine = makeEngine([SEGMENTS])

  it('default gate (multi-AOI dropped, no sentinel) — sequences and expected literals agree', () => {
    const extracted = extractFixationSequence(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      engine as any,
      STIM,
      0,
      { aoiSelectionId: SELECTION_ID }
    )
    // Pin the expected content so both builders cannot drift together.
    expect(extracted.seq).toEqual([A, A, B, B])
    expect(extracted.timestamps).toEqual([0, 100, 500, 600])
    expect(extracted.endTimestamps).toEqual([50, 150, 550, 650])

    expect(recipeSeq(engine, 'rqaRec', { include_no_aoi: false })).toEqual(
      extracted.seq
    )
  })

  it('include_no_aoi — zero-AOI and out-of-selection fixations become the sentinel in BOTH builders', () => {
    const extracted = extractFixationSequence(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      engine as any,
      STIM,
      0,
      { includeNoAoi: true, aoiSelectionId: SELECTION_ID }
    )
    expect(extracted.seq).toEqual([A, A, N, N, B, B])
    expect(extracted.timestamps).toEqual([0, 100, 300, 400, 500, 600])

    expect(recipeSeq(engine, 'rqaRec', { include_no_aoi: true })).toEqual(
      extracted.seq
    )
  })

  it('a time range clips BOTH builders identically, so window indices keep meaning', () => {
    // The Metric Timeline resolves `timeline[i]` (an index into the scan's
    // sequence) against this extract, so a range the scan applies and the extract
    // does not would silently draw every cell on the wrong fixation.
    const extracted = extractFixationSequence(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      engine as any,
      STIM,
      0,
      { includeNoAoi: true, aoiSelectionId: SELECTION_ID, timeStart: 300, timeEnd: 600 }
    )
    expect(extracted.timestamps).toEqual([300, 400, 500])

    expect(
      recipeSeq(engine, 'rqaRec', { include_no_aoi: true }, 300, 600)
    ).toEqual(extracted.seq)
  })

  it('holds for every fixation-windowed RQA recipe (shared factory gate)', () => {
    for (const baseId of ['rqaRec', 'rqaDet', 'rqaLam']) {
      for (const includeNoAoi of [false, true]) {
        const extracted = extractFixationSequence(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          engine as any,
          STIM,
          0,
          { includeNoAoi, aoiSelectionId: SELECTION_ID }
        )
        expect(
          recipeSeq(engine, baseId, { include_no_aoi: includeNoAoi }),
          `${baseId} include_no_aoi=${includeNoAoi}`
        ).toEqual(extracted.seq)
      }
    }
  })
})
