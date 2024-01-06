import { get, writable } from 'svelte/store'
import type { ScarfSettingsType } from '$lib/type/Settings/ScarfSettings/ScarfSettingsType.ts'

const getUniqueScarfPlotId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000)
}
const returnDefaultScarfPlotState = (
  isPrerendered = false
): ScarfSettingsType[] => {
  return [
    {
      scarfPlotId: isPrerendered ? 0 : getUniqueScarfPlotId(),
      stimulusId: 0,
      zoomLevel: 0,
      aoiVisibility: false,
      timeline: 'absolute',
      absoluteGeneralLastVal: 0,
      absoluteStimuliLastVal: [],
      ordinalGeneralLastVal: 0,
      ordinalStimuliLastVal: [],
    },
  ]
}
export const scarfPlotStates = writable<ScarfSettingsType[]>(
  returnDefaultScarfPlotState(true)
)
export const setDefaultScarfPlotState = (): void => {
  scarfPlotStates.set(returnDefaultScarfPlotState())
}

export const removeScarfPlotState = (scarfPlotId: number): void => {
  scarfPlotStates.update(prev =>
    prev.filter(state => state.scarfPlotId !== scarfPlotId)
  )
}

export const getScarfPlotState = (
  scarfStates: ScarfSettingsType[],
  scarfPlotId: number
): ScarfSettingsType | undefined => {
  return scarfStates.find(state => state.scarfPlotId === scarfPlotId)
}

const getDefinedScarfPlotState = (
  scarfStates: ScarfSettingsType[],
  scarfPlotId: number
): ScarfSettingsType => {
  const scarfPlotState = getScarfPlotState(scarfStates, scarfPlotId)
  if (scarfPlotState === undefined)
    throw new Error(`Scarf plot state with id ${scarfPlotId} not found`)
  return scarfPlotState
}

export const getStimulusId = (scarfPlotId: number): number => {
  const scarfStates = get(scarfPlotStates)
  const scarfPlotState = getScarfPlotState(scarfStates, scarfPlotId)
  if (scarfPlotState === undefined)
    throw new Error(`Scarf plot state with id ${scarfPlotId} not found`)
  return scarfPlotState.stimulusId
}

export const getStimulusLastValue = (
  scarfPlotId: number,
  stimulusId: number,
  type: 'absolute' | 'ordinal'
): number => {
  const scarfStates = get(scarfPlotStates)
  const scarfPlotState = getDefinedScarfPlotState(scarfStates, scarfPlotId)
  if (type === 'absolute') {
    const val = scarfPlotState.absoluteStimuliLastVal[stimulusId]
    if (!Number.isNaN(val)) return val
    return 0
  } else {
    const val = scarfPlotState.ordinalStimuliLastVal[stimulusId]
    if (!Number.isNaN(val)) return val
    return 0
  }
}

export const updateTimeline = (
  scarfPlotId: number,
  timeline: 'absolute' | 'relative' | 'ordinal'
): void => {
  scarfPlotStates.update(prev => {
    const newState = getDefinedScarfPlotState(prev, scarfPlotId)
    newState.timeline = timeline
    return prev
  })
}

export const updateStimulusId = (
  scarfPlotId: number,
  stimulusId: number
): void => {
  scarfPlotStates.update(prev => {
    const newState = getDefinedScarfPlotState(prev, scarfPlotId)
    newState.stimulusId = stimulusId
    return prev
  })
}

export const updateZoom = (scarfPlotId: number, zoom: number): void => {
  scarfPlotStates.update(prev => {
    const newState = getDefinedScarfPlotState(prev, scarfPlotId)
    newState.zoomLevel = zoom
    return prev
  })
}

export const updateStimulusLastValue = (
  scarfPlotId: number,
  stimulusId: number,
  lastValue: number,
  type: 'absolute' | 'ordinal'
): void => {
  scarfPlotStates.update(prev => {
    const newState = getDefinedScarfPlotState(prev, scarfPlotId)
    if (type === 'absolute') {
      newState.absoluteStimuliLastVal[stimulusId] = lastValue
    }
    if (type === 'ordinal') {
      newState.ordinalStimuliLastVal[stimulusId] = lastValue
    }
    return prev
  })
}

export const duplicateScarfPlotState = (scarfPlotId: number): void => {
  scarfPlotStates.update(prev => {
    const scarfPlotState = getDefinedScarfPlotState(prev, scarfPlotId)
    prev.push({
      ...scarfPlotState,
      scarfPlotId: getUniqueScarfPlotId(),
    })
    return prev
  })
}

export const updateAoiVisibilityForAll = (value: boolean): void => {
  scarfPlotStates.update(prev => {
    const newState = [...prev]
    newState.forEach(state => {
      state.aoiVisibility = value
    })
    return newState
  })
}
