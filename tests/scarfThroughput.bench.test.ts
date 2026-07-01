/**
 * Throughput benchmark for the scarf BASE data→render path (full extent, whole
 * timeline visible — the case that matters). Env-gated so it never runs in CI:
 *
 *   SCARF_BENCH=1 npx vitest run tests/scarfThroughput.bench.test.ts
 *
 * Builds a large synthetic engine, then times a single cold-ish transform
 * (getScarfData → transformDataToScarfPlot) and a single render accumulate
 * (drawScarfBands → paintGazeRects; the composite blit no-ops in node, but the
 * O(segments) accumulate — the real render cost — runs fully). Reports ms/run and
 * ns/segment so optimizations can be A/B'd against a stable baseline.
 */
import { describe, it } from 'vitest'
import { createReaderFromJson } from '../src/lib/data/binary/converters'
import { AoiGroupReader } from '../src/lib/data/binary/reader.aoiGroup'
import { FIXATION_CATEGORY_ID } from '../src/lib/data/binary/schema'
import { getScarfData } from '../src/lib/plots/scarf/core/view'
import { drawScarfBands, type ScarfLayoutContext } from '../src/lib/plots/scarf/core/renderer'
import type { ScarfPlotSettings } from '../src/lib/plots/scarf/types'

const RUN = !!process.env.SCARF_BENCH

// ---- synthetic dataset ----
const N_PARTICIPANTS = Number(process.env.SCARF_BENCH_P ?? 40)
const SEGS_PER_P = Number(process.env.SCARF_BENCH_M ?? 10000)
const N_AOIS = Number(process.env.SCARF_BENCH_AOI ?? 6)
const STIM = 1

/** One participant's segments: alternating fixation (1 AOI) / saccade, sorted by
 *  time. Row = [start, end, categoryId, ...aoiRawIds]. */
function buildParticipantSegments(seed: number): number[][] {
  const segs: number[][] = []
  let t = 0
  let s = seed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000)
  for (let i = 0; i < SEGS_PER_P; i++) {
    const isFix = i % 4 !== 0 // ~75% fixations
    const dur = isFix ? 120 + Math.floor(rnd() * 180) : 20 + Math.floor(rnd() * 40)
    const start = t
    const end = t + dur
    t = end + 5
    if (isFix) {
      const aoi = 1 + Math.floor(rnd() * N_AOIS) // raw AOI id in 1..N_AOIS
      segs.push([start, end, FIXATION_CATEGORY_ID, aoi])
    } else {
      segs.push([start, end, 1]) // category 1 = saccade, no AOI
    }
  }
  return segs
}

function buildEngine() {
  const perP: number[][][] = []
  for (let p = 0; p < N_PARTICIPANTS; p++) perP.push(buildParticipantSegments(p + 1))
  const segments: number[][][][] = [[], perP]
  const reader = createReaderFromJson(segments)

  const aoiData: (string[] | null)[] = [null]
  const order: number[] = []
  for (let i = 1; i <= N_AOIS; i++) {
    aoiData.push([`AOI ${i}`, `AOI ${i}`, ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628'][(i - 1) % 6]])
    order.push(i)
  }

  const metadata = {
    isOrdinalOnly: false,
    capabilities: { segmented: true, spatial: false, event: false },
    aois: { data: [[], aoiData], orderVector: [[], order], hiddenAois: [[], []] },
    categories: {
      data: [['Fixation', 'Fixation', '#000000'], ['Saccade', 'Saccade', '#cccccc']],
      orderVector: [],
    },
    participants: {
      data: Array.from({ length: N_PARTICIPANTS }, (_, i) => [`P${i}`, `P${i}`]),
      orderVector: [],
    },
    participantsGroups: [],
    stimuli: { data: [['S0', 'S0'], ['S1', 'S1']], orderVector: [] },
    noAoiTreatment: { displayedName: 'Outside', color: 'gray' },
    metricInstances: [],
  }

  const aoiGroupReader = new AoiGroupReader(reader)
  aoiGroupReader.updateMap(metadata as never)

  return {
    metadata,
    // Top-level engine surface some selectors read directly (not via metadata).
    capabilities: { segmented: true, spatial: false, event: false },
    eventsPerStimulus: [],
    getReader: () => reader,
    getAoiGroupReader: () => aoiGroupReader,
    getAoiMapping: (sId: number, rawId: number) => aoiGroupReader.getAoiMapping(sId, rawId),
  } as never
}

function stubCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    stroke() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    rect() {},
    clip() {},
    fillRect() {},
    fillText() {},
    setLineDash() {},
    translate() {},
    rotate() {},
    setTransform() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D
}

function bench(label: string, runs: number, fn: () => void) {
  for (let i = 0; i < 2; i++) fn() // warm
  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const median = times[times.length >> 1]
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  return { label, median, mean, min: times[0] }
}

describe.skipIf(!RUN)('scarf throughput (base full-extent path)', () => {
  it('transform + render accumulate', async () => {
    const engine = buildEngine()
    const settings: ScarfPlotSettings = {
      stimulusId: STIM,
      groupId: -1,
      timeline: 'absolute',
      absoluteStimuliLimits: [],
      ordinalStimuliLimits: [],
      timelineStart: 0,
      timelineEnd: 0,
    }

    const data0 = getScarfData(engine, settings)
    if (!data0) throw new Error('getScarfData returned null')
    const totalSegs = N_PARTICIPANTS * SEGS_PER_P
    const rectEntries = data0.visualRectBuckets.reduce((n, b) => n + b.length / 6, 0)

    const layout: ScarfLayoutContext = {
      heightOfBar: 16,
      spaceAboveRect: 4,
      nonFixationHeight: 4,
      heightOfBarWrap: 24,
      scaleFactor: 1,
      isCompact: false,
      leftLabelWidth: 60,
      plotAreaWidth: 1500,
      effectiveMarginTop: 8,
      participantBarsHeight: N_PARTICIPANTS * 24,
      totalWidth: 1600,
      marginLeft: 0,
      eventLaneHeight: 0,
      eventZoneHeight: 0,
      eventBandTop: 0,
      isOverlay: false,
      deviceScale: 2,
    } as unknown as ScarfLayoutContext

    const rectStyleArray = data0.visualRectBuckets.map(() => ({ normal: { fill: '#3366cc' } })) as never
    const ctx = stubCtx()

    if (process.env.SCARF_PROFILE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const inspector = require('node:inspector')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs')
      const session = new inspector.Session()
      session.connect()
      const post = (m: string, p?: unknown) =>
        new Promise<any>((res, rej) =>
          session.post(m, p, (e: unknown, r: unknown) => (e ? rej(e) : res(r)))
        )
      await post('Profiler.enable')
      await post('Profiler.setSamplingInterval', { interval: 40 })
      await post('Profiler.start')
      for (let i = 0; i < 20; i++) getScarfData(engine, settings)
      const { profile } = await post('Profiler.stop')
      fs.writeFileSync(process.env.SCARF_PROFILE_OUT || '/tmp/scarf.cpuprofile', JSON.stringify(profile))
      return
    }

    const tRes = bench('transform', 8, () => {
      getScarfData(engine, settings)
    })
    const rRes = bench('render-accum', 8, () => {
      drawScarfBands(ctx, data0, layout, rectStyleArray, [] as never, null)
    })

    const perSeg = (ms: number) => ((ms * 1e6) / totalSegs).toFixed(1)
    const out =
      `=== scarf throughput: ${N_PARTICIPANTS}p × ${SEGS_PER_P} = ${totalSegs} segments, ${rectEntries} rect entries ===\n` +
      `transform     median ${tRes.median.toFixed(1)}ms  mean ${tRes.mean.toFixed(1)}ms  (${perSeg(tRes.median)} ns/seg)\n` +
      `render-accum  median ${rRes.median.toFixed(1)}ms  mean ${rRes.mean.toFixed(1)}ms  (${perSeg(rRes.median)} ns/seg)\n` +
      `combined      ${(tRes.median + rRes.median).toFixed(1)}ms per pass\n`
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').writeFileSync(process.env.SCARF_BENCH_OUT || '/tmp/scarf-bench.txt', out)
    process.stderr.write('\n' + out + '\n')
  })
})
