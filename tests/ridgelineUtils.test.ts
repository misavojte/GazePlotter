import { describe, it, expect, vi } from 'vitest'
import {
  calculateFilledRidgelineStripHeight,
  calculateIdealStripHeight,
  calculateMaxReferenceHeight,
} from '$lib/plots/aoi-stream/core/ridgeline'
import { scanForDynamicRidgelineReferenceHeight } from '$lib/plots/aoi-stream/sync/ridgeline'
import type {
  AoiStreamPlotItem,
  AoiStreamPlotSettings,
} from '$lib/plots/aoi-stream/types'

// Mock dependencies
vi.mock('$lib/plots/shared', () => ({
  calculatePlotDimensionsWithHeader: () => ({ width: 800, height: 600 }),
  PLOT_HEADER_HEIGHT: 138,
}))

vi.mock('$lib/plots/shared/legendRendering', () => ({
  calculateFlatLegendHeight: () => 50,
  STREAM_LEGEND_CONFIG: { fontSize: 12, fontFamily: 'Arial' },
}))

vi.mock('$lib/shared/utils/textUtils', () => ({
  estimateTextWidth: () => 10,
  SYSTEM_SANS_SERIF_STACK: 'Arial',
}))

vi.mock('$lib/data/engine', () => ({
  getParticipants: () => [{ id: 1 }],
  getParticipantEndTime: () => 100,
}))

vi.mock('$lib/plots/aoi-stream/core/transformer', () => ({
  getAoiStreamPlotData: () => ({
    data: {
      series: [
        {
          values: new Float32Array(10).fill(1),
          id: 1,
          label: 'AOI 1',
          color: 'red',
        },
      ],
      binCount: 10,
      participants: 1,
      timeline: { minValue: 0, maxValue: 100 },
      maxTime: 100,
      maxTotal: 1,
    },
    workspace: null,
  }),
}))

vi.mock('$lib/plots/aoi-stream/sync/timeline', () => ({
  scanForSynchronizedTimelineMax: () => null,
}))

describe('Ridgeline Utilities', () => {
  describe('calculateIdealStripHeight', () => {
    it('should calculate correct height for single series at 100%', () => {
      // Setup: 1 series, 100% max value
      const data = {
        series: [
          {
            values: new Float32Array(10).fill(1),
            id: 1,
            label: 's1',
            color: 'red',
          },
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (without applyMinTopHeight):
      // geometricOffset = (1-1-0)*(1-0.6) = 0
      // dataHeight = (100 * 0.9 / 100) = 0.9
      // maxFactor = 0.9
      // Ideal = 100 / 0.9 = 111.11

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(111.11, 1)
    })

    it('should respect stacking offset for multiple series', () => {
      // Setup: 2 series, both 0% (empty) to test pure geometric stacking
      // Note: calculateMaxConstraintFactor iterates all.
      const data = {
        series: [
          { values: new Float32Array(10).fill(0), id: 1 }, // Top (s=0)
          { values: new Float32Array(10).fill(0), id: 2 }, // Bottom (s=1)
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (without applyMinTopHeight - default for sync):
      // s=0: geom=(2-1-0)*0.4 = 0.4. data=0. Total=0.4
      // s=1: geom=(2-1-1)*0.4 = 0.0. data=0. Total=0.0
      // maxFactor = 0.4

      // Ideal = 100 / 0.4 = 250

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(250, 1)
    })

    it('should apply minTopHeight constraint when flag is true', () => {
      // Setup: 2 series, both 0% (empty) to test minTopHeight constraint
      const data = {
        series: [
          { values: new Float32Array(10).fill(0), id: 1 }, // Top (s=0)
          { values: new Float32Array(10).fill(0), id: 2 }, // Bottom (s=1)
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic (WITH applyMinTopHeight - for local rendering):
      // s=0: geom=(2-1-0)*0.4 = 0.4. data=0. minTopHeight=0.2. Total=0.4 + 0.2 = 0.6
      // s=1: geom=(2-1-1)*0.4 = 0.0. data=0. Total=0.0
      // maxFactor = 0.6

      // Ideal = 100 / 0.6 = 166.67

      const height = calculateIdealStripHeight(data, plotHeight, true)
      expect(height).toBeCloseTo(166.67, 1)
    })

    it('should account for data height in stacking', () => {
      // Setup: 2 series. Top(s=0) has 100%, Bot(s=1) has 0%.
      // Note: Raw value '1' with participants=1 becomes 100%.
      const data = {
        series: [
          { values: new Float32Array(10).fill(1), id: 1 },
          { values: new Float32Array(10).fill(0), id: 2 },
        ],
        binCount: 10,
        participants: 1,
      } as any
      const plotHeight = 100

      // Logic:
      // s=0: geom=0.4. data=(100*0.9/100)=0.9. Total=1.3
      // s=1: geom=0.0. data=0.0. Total=0.0
      // maxFactor = 1.3

      // Ideal = 100 / 1.3 = 76.92

      const height = calculateIdealStripHeight(data, plotHeight)
      expect(height).toBeCloseTo(76.92, 1)
    })
  })

  describe('calculateMaxReferenceHeight', () => {
    it('should remove top whitespace according to the highest visible peak when overlap is allowed', () => {
      const data = {
        series: [
          { values: new Float32Array(10).fill(0), id: 1 },
          { values: new Float32Array(10).fill(1), id: 2 },
        ],
        binCount: 10,
        participants: 1,
      } as any

      const referenceHeight = calculateMaxReferenceHeight(data, 100, 2.5, true)

      expect(referenceHeight).toBeCloseTo(111.11, 1)
    })

    it('should keep scale 1 inside a single strip with no cross-strip overlap', () => {
      const data = {
        series: [
          { values: new Float32Array(10).fill(0.5), id: 1 },
          { values: new Float32Array(10).fill(1), id: 2 },
        ],
        binCount: 10,
        participants: 1,
      } as any

      const plotHeight = 100
      const stripHeight = calculateFilledRidgelineStripHeight(plotHeight, 2, 1)
      const referenceHeight = calculateMaxReferenceHeight(
        data,
        plotHeight,
        1,
        true
      )

      expect(referenceHeight * 0.9).toBeCloseTo(stripHeight, 1)
    })
  })

  describe('scanForDynamicRidgelineReferenceHeight', () => {
    it('should synchronize ridgeline plots with matching height and scale', () => {
      const engine = {
        metadata: {},
      } as any

      const createItem = (
        id: number,
        settings: Partial<AoiStreamPlotSettings>
      ): AoiStreamPlotItem => ({
        id,
        x: 0,
        y: 0,
        w: 12,
        h: 10,
        min: { w: 11, h: 10 },
        redrawTimestamp: 0,
        type: 'aoiStreamPlot',
        settings: {
          stimulusId: 0,
          groupId: -1,
          binSize: 500,
          absoluteStimuliLimits: [],
          ...settings,
        },
      })

      const items: AoiStreamPlotItem[] = [
        createItem(1, {
          alignment: 'ridgeline',
          ridgelineScale: 0.6,
        }),
        createItem(2, {
          alignment: 'ridgeline',
          ridgelineScale: 0.6,
        }),
      ]

      const currentStreamData = {
        series: [
          {
            values: new Float32Array(10).fill(1),
            id: 1,
            label: 'AOI 1',
            color: 'red',
          },
        ],
        binCount: 10,
        participants: 1,
        timeline: { minValue: 0, maxValue: 100 },
        maxTime: 100,
        maxTotal: 1,
      } as any

      const result = scanForDynamicRidgelineReferenceHeight(
        engine,
        items,
        10,
        1,
        {
          plotId: 1,
          widthUnits: 12,
          heightUnits: 10,
          settings: items[0].settings,
          streamData: currentStreamData,
        }
      )

      // The sync now returns the max mTop across candidates (dimension-independent).
      // Both items are identical with 1 series at 100% occupancy (values=1, participants=1).
      // mTop = (100/100) * RIDGELINE_CONTENT_FILL = 0.9, clamped to max(0.9, 0.2) = 0.9
      expect(result).not.toBeNull()
      expect(result!).toBeGreaterThan(0)
      expect(result!).toBeLessThanOrEqual(1)
    })
  })
})
