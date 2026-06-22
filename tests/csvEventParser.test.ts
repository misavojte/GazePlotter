import { describe, it, expect } from 'vitest'
import {
  parseCsvEventText,
  resolveContributionsForEngine,
  mergeIntoStimulusMap,
} from '$lib/data/ingest/formats/csvEvent'

// --- parseCsvEventText ---

describe('parseCsvEventText', () => {
  it('parses basic comma-delimited CSV', () => {
    const csv = [
      'stimulus,participant,eventName,start,duration',
      'Image1,P01,AOI_Face,0,500',
      'Image1,P01,AOI_Face,1200,300',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(0)
    expect(rows).toEqual([
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500 },
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 1200, duration: 300 },
    ])
  })

  it('parses semicolon-delimited CSV', () => {
    const csv = [
      'stimulus;participant;eventName;start;duration',
      'Image1;P01;AOI_Face;0;500',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].stimulus).toBe('Image1')
  })

  it('handles columns in arbitrary order', () => {
    const csv = [
      'duration,eventName,start,participant,stimulus',
      '500,AOI_Face,0,P01,Image1',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(0)
    expect(rows[0]).toEqual({
      stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500,
    })
  })

  it('handles CRLF line endings', () => {
    const csv = 'stimulus,participant,eventName,start,duration\r\nImage1,P01,AOI_Face,0,500\r\n'

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(0)
    expect(rows).toHaveLength(1)
  })

  it('skips empty lines', () => {
    const csv = [
      'stimulus,participant,eventName,start,duration',
      '',
      'Image1,P01,AOI_Face,0,500',
      '',
      'Image1,P01,AOI_Face,100,200',
      '',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(0)
    expect(rows).toHaveLength(2)
  })

  it('warns on missing required column', () => {
    const csv = 'stimulus,participant,start,duration\nImage1,P01,0,500'

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('eventName')
    expect(rows).toHaveLength(0)
  })

  it('warns and skips rows with invalid numbers', () => {
    const csv = [
      'stimulus,participant,eventName,start,duration',
      'Image1,P01,AOI_Face,abc,500',
      'Image1,P01,AOI_Face,0,xyz',
      'Image1,P01,AOI_Face,100,200',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(2)
    expect(rows).toHaveLength(1)
    expect(rows[0].start).toBe(100)
  })

  it('warns and skips rows with empty stimulus or eventName', () => {
    const csv = [
      'stimulus,participant,eventName,start,duration',
      ',P01,AOI_Face,0,500',
      'Image1,P01,,0,500',
    ].join('\n')

    const { contributions: rows, warnings } = parseCsvEventText(csv)
    expect(warnings).toHaveLength(2)
    expect(rows).toHaveLength(0)
  })

  it('handles zero duration (instant events)', () => {
    const csv = [
      'stimulus,participant,eventName,start,duration',
      'Image1,P01,Marker,2000,0',
    ].join('\n')

    const { contributions: rows } = parseCsvEventText(csv)
    expect(rows[0].duration).toBe(0)
  })

  it('returns empty result for empty file', () => {
    const { contributions: rows, warnings } = parseCsvEventText('')
    expect(rows).toHaveLength(0)
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// --- resolveContributionsForEngine ---

describe('resolveContributionsForEngine', () => {
  // Simulated engine metadata
  const stimuliData = [
    ['Image1', 'Image1', '#ff0000'],
    ['Image2', 'Image2', '#00ff00'],
  ]
  const participantsData = [
    ['P01', 'P01'],
    ['P02', 'P02'],
    ['P03', 'P03'],
  ]
  const participantCount = 3
  const aoiData = [
    [['AOI_Face', 'AOI_Face', '#aabbcc'], ['AOI_Hand', 'AOI_Hand', '#ddeeff']],
    [],
  ]

  it('resolves stimulus and participant names to IDs', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500 },
      { stimulus: 'Image1', participant: 'P02', channel: 'AOI_Face', start: 100, duration: 200 },
    ]

    const { stimulusMap, warnings } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount, aoiData
    )
    expect(warnings).toHaveLength(0)
    expect(stimulusMap.has(0)).toBe(true)

    const channel = stimulusMap.get(0)!.get('AOI_Face')!
    // P01 (index 0) should have [0, 500]
    expect(channel.perParticipant[0]).toEqual([0, 500])
    // P02 (index 1) should have [100, 200]
    expect(channel.perParticipant[1]).toEqual([100, 200])
    // P03 (index 2) should be empty
    expect(channel.perParticipant[2]).toEqual([])
  })

  it('applies * participant to all participants', () => {
    const rows = [
      { stimulus: 'Image1', participant: '*', channel: 'Marker', start: 2000, duration: 0 },
    ]

    const { stimulusMap, warnings } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount
    )
    expect(warnings).toHaveLength(0)

    const channel = stimulusMap.get(0)!.get('Marker')!
    for (let p = 0; p < participantCount; p++) {
      expect(channel.perParticipant[p]).toEqual([2000, 0])
    }
  })

  it('warns on unmatched stimulus name', () => {
    const rows = [
      { stimulus: 'Unknown', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500 },
    ]

    const { stimulusMap, warnings } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Unknown')
    expect(stimulusMap.size).toBe(0)
  })

  it('warns on unmatched participant name', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P99', channel: 'AOI_Face', start: 0, duration: 500 },
    ]

    const { stimulusMap, warnings } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('P99')
    expect(stimulusMap.size).toBe(0)
  })

  it('inherits AOI color when channel name matches', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500 },
    ]

    const { stimulusMap } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount, aoiData
    )
    const channel = stimulusMap.get(0)!.get('AOI_Face')!
    expect(channel.def[2]).toBe('#aabbcc')
  })

  it('defaults to #888888 when no AOI match', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P01', channel: 'Custom', start: 0, duration: 500 },
    ]

    const { stimulusMap } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount, aoiData
    )
    const channel = stimulusMap.get(0)!.get('Custom')!
    expect(channel.def[2]).toBe('#888888')
  })

  it('accumulates multiple events for same channel and participant', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 0, duration: 500 },
      { stimulus: 'Image1', participant: 'P01', channel: 'AOI_Face', start: 1200, duration: 300 },
    ]

    const { stimulusMap } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount
    )
    const channel = stimulusMap.get(0)!.get('AOI_Face')!
    // Stride-2: [start, dur, start, dur]
    expect(channel.perParticipant[0]).toEqual([0, 500, 1200, 300])
  })

  it('handles multiple stimuli in one file', () => {
    const rows = [
      { stimulus: 'Image1', participant: 'P01', channel: 'Ch1', start: 0, duration: 100 },
      { stimulus: 'Image2', participant: 'P01', channel: 'Ch2', start: 50, duration: 200 },
    ]

    const { stimulusMap } = resolveContributionsForEngine(
      rows, stimuliData, participantsData, participantCount
    )
    expect(stimulusMap.has(0)).toBe(true)
    expect(stimulusMap.has(1)).toBe(true)
    expect(stimulusMap.get(0)!.has('Ch1')).toBe(true)
    expect(stimulusMap.get(1)!.has('Ch2')).toBe(true)
  })
})

// --- mergeIntoStimulusMap ---

describe('mergeIntoStimulusMap', () => {
  it('merges non-overlapping stimuli', () => {
    const target = new Map([
      [0, new Map([['Ch1', { def: ['Ch1', 'Ch1', '#aaa'], perParticipant: [[10, 20]] }]])],
    ])
    const source = new Map([
      [1, new Map([['Ch2', { def: ['Ch2', 'Ch2', '#bbb'], perParticipant: [[30, 40]] }]])],
    ])

    mergeIntoStimulusMap(target, source)
    expect(target.size).toBe(2)
    expect(target.get(1)!.get('Ch2')!.perParticipant[0]).toEqual([30, 40])
  })

  it('merges overlapping stimulus + channel by concatenating buffers', () => {
    const target = new Map([
      [0, new Map([['Ch1', { def: ['Ch1', 'Ch1', '#aaa'], perParticipant: [[10, 20]] }]])],
    ])
    const source = new Map([
      [0, new Map([['Ch1', { def: ['Ch1', 'Ch1', '#aaa'], perParticipant: [[30, 40]] }]])],
    ])

    mergeIntoStimulusMap(target, source)
    expect(target.get(0)!.get('Ch1')!.perParticipant[0]).toEqual([10, 20, 30, 40])
  })

  it('merges overlapping stimulus with different channels', () => {
    const target = new Map([
      [0, new Map([['Ch1', { def: ['Ch1', 'Ch1', '#aaa'], perParticipant: [[10, 20]] }]])],
    ])
    const source = new Map([
      [0, new Map([['Ch2', { def: ['Ch2', 'Ch2', '#bbb'], perParticipant: [[30, 40]] }]])],
    ])

    mergeIntoStimulusMap(target, source)
    expect(target.get(0)!.size).toBe(2)
  })
})
