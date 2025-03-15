import { describe, it, expect, vi } from 'vitest'
import {
  getScarfParticipantBarHeight,
  calculateTimelineMax,
  createStimuliList,
  createStylingAndLegend,
  createSegmentContents,
  generateScarfPlotCSS,
} from '../src/lib/utils/scarfPlotTransformations'
import {
  IDENTIFIER_IS_AOI,
  IDENTIFIER_IS_OTHER_CATEGORY,
  IDENTIFIER_NOT_DEFINED,
} from '../src/lib/const/identifiers'
import type { BaseInterpretedDataType } from '../src/lib/type/Data/InterpretedData/BaseInterpretedDataType'
import type { ExtendedInterpretedDataType } from '../src/lib/type/Data/InterpretedData/ExtendedInterpretedDataType'
import type { SegmentInterpretedDataType } from '../src/lib/type/Data/InterpretedData/SegmentInterpretedDataType'
import type { ScarfGridType } from '../src/lib/type/gridType'
import type {
  SingleStylingScarfFillingType,
  StylingScarfFillingType,
} from '../src/lib/type/Filling/ScarfFilling'

// Mock dependencies to isolate unit tests
vi.mock('../src/lib/stores/dataStore', () => ({
  getAois: vi.fn(),
  getAoiVisibility: vi.fn(),
  getNumberOfSegments: vi.fn(),
  getParticipant: vi.fn(),
  getParticipantEndTime: vi.fn(),
  getSegment: vi.fn(),
  getStimuli: vi.fn(),
  hasStimulusAoiVisibility: vi.fn(),
}))

// Disable TypeScript checking for this specific import
/* eslint-disable @typescript-eslint/ban-ts-comment */

describe('Scarf Plot Transformations', () => {
  describe('getScarfParticipantBarHeight', () => {
    it('returns correct height without AOI visibility', () => {
      const height = getScarfParticipantBarHeight(20, 5, 3, false, 6)
      expect(height).toBe(30) // barHeight(20) + spaceAboveRect(5) * 2
    })

    it('returns correct height with AOI visibility', () => {
      const height = getScarfParticipantBarHeight(20, 5, 3, true, 6)
      expect(height).toBe(48) // (barHeight(20) + spaceAboveRect(5) * 2) + aoiCount(3) * lineWrappedHeight(6)
    })
  })

  describe('calculateTimelineMax', () => {
    it('returns 100 for relative timeline', () => {
      const settings: Partial<ScarfGridType> = { timeline: 'relative' }
      const result = calculateTimelineMax([], 0, settings as ScarfGridType)
      expect(result).toEqual({ maxValue: 100, isCut: false })
    })
  })

  describe('createStimuliList', () => {
    it('maps stimulus data to correct format', () => {
      const stimuliData: Partial<BaseInterpretedDataType>[] = [
        { id: 1, displayedName: 'Stimulus 1', originalName: 'stim1' },
        { id: 2, displayedName: 'Stimulus 2', originalName: 'stim2' },
      ]

      const result = createStimuliList(stimuliData as BaseInterpretedDataType[])

      expect(result).toEqual([
        { id: 1, name: 'Stimulus 1' },
        { id: 2, name: 'Stimulus 2' },
      ])
    })
  })

  describe('createStylingAndLegend', () => {
    it('creates styling data with correct identifiers', () => {
      const aoiData: Partial<ExtendedInterpretedDataType>[] = [
        {
          id: 1,
          displayedName: 'AOI 1',
          color: '#ff0000',
          originalName: 'aoi1',
        },
        {
          id: 2,
          displayedName: 'AOI 2',
          color: '#00ff00',
          originalName: 'aoi2',
        },
      ]

      const result = createStylingAndLegend(
        aoiData as ExtendedInterpretedDataType[]
      )

      // Check AOI styling
      expect(result.aoi).toHaveLength(3) // 2 AOIs + 1 for "No AOI hit"
      expect(result.aoi[0].identifier).toBe(`${IDENTIFIER_IS_AOI}1`)
      expect(result.aoi[1].identifier).toBe(`${IDENTIFIER_IS_AOI}2`)
      expect(result.aoi[2].identifier).toBe(
        `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`
      )

      // Check category styling
      expect(result.category).toHaveLength(2)
      expect(result.category[0].identifier).toBe(
        `${IDENTIFIER_IS_OTHER_CATEGORY}1`
      )
      expect(result.category[1].identifier).toBe(
        `${IDENTIFIER_IS_OTHER_CATEGORY}${IDENTIFIER_NOT_DEFINED}`
      )

      // Check visibility styling
      expect(result.visibility).toEqual([])
    })
  })

  describe('createSegmentContents', () => {
    it('handles non-fixation segment correctly', () => {
      const segmentMock = {
        category: { id: 1 },
        aoi: [],
        start: 100,
        end: 200,
      }

      // Cast to SegmentInterpretedDataType to satisfy TypeScript
      const result = createSegmentContents(
        segmentMock as unknown as SegmentInterpretedDataType,
        '10%',
        '5%'
      )

      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe(`${IDENTIFIER_IS_OTHER_CATEGORY}1`)
    })

    it('handles fixation without AOI correctly', () => {
      const segmentMock = {
        category: { id: 0 },
        aoi: [],
        start: 100,
        end: 200,
      }

      // Cast to SegmentInterpretedDataType to satisfy TypeScript
      const result = createSegmentContents(
        segmentMock as unknown as SegmentInterpretedDataType,
        '10%',
        '5%'
      )

      expect(result).toHaveLength(1)
      expect(result[0].identifier).toBe(
        `${IDENTIFIER_IS_AOI}${IDENTIFIER_NOT_DEFINED}`
      )
    })
  })

  describe('generateScarfPlotCSS', () => {
    it('generates CSS without highlight', () => {
      const stylingData: Partial<StylingScarfFillingType> = {
        aoi: [
          {
            identifier: 'aoi1',
            color: '#ff0000',
            height: 20,
            heighOfLegendItem: 20,
            name: 'AOI 1',
          } as SingleStylingScarfFillingType,
        ],
        category: [
          {
            identifier: 'cat1',
            color: '#0000ff',
            height: 4,
            heighOfLegendItem: 20,
            name: 'Category 1',
          } as SingleStylingScarfFillingType,
        ],
        visibility: [],
      }

      const css = generateScarfPlotCSS(
        'plot-area',
        stylingData as StylingScarfFillingType,
        null
      )

      expect(css).toContain('<style>')
      expect(css).toContain('#plot-area .aoi1{fill:#ff0000;}')
      expect(css).toContain('#plot-area .cat1{fill:#0000ff;}')
      expect(css).not.toContain('opacity')
    })

    it('generates CSS with highlight', () => {
      const stylingData: Partial<StylingScarfFillingType> = {
        aoi: [
          {
            identifier: 'aoi1',
            color: '#ff0000',
            height: 20,
            heighOfLegendItem: 20,
            name: 'AOI 1',
          } as SingleStylingScarfFillingType,
        ],
        category: [],
        visibility: [],
      }

      const css = generateScarfPlotCSS(
        'plot-area',
        stylingData as StylingScarfFillingType,
        'aoi1'
      )

      expect(css).toContain('<style>')
      expect(css).toContain('#plot-area .aoi1{fill:#ff0000;}')
      expect(css).toContain('opacity:0.2')
    })
  })
})
