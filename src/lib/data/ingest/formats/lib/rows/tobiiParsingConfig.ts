/**
 * Keyed configuration carried in the Tobii prompt answer
 * (`ParseSettings.userInputSetting`). Serialized as JSON by the
 * tobii-parsing-input modal and parsed here. Producer and consumer ship in
 * the same build, so there is no versioning and no legacy fallback — a
 * value that fails to parse is a programming error, not a data condition.
 *
 * Every key is opt-in by presence; the empty config ('') means
 * media-column stimulus parsing. Stimulus keys match Event-row names by
 * suffix — the stripped remainder names the stimulus. Event extraction
 * carries no config at all: every non-system Event row imports as a
 * discrete event; interval semantics are applied post-import by the
 * event library's interval derivation (`$lib/data/engine/eventIntervals.ts`).
 */
export interface TobiiParsingConfig {
  /** Suffix of Event rows that OPEN a stimulus interval (name = rest). */
  stimulusStartSuffix?: string
  /** Suffix of Event rows that CLOSE a stimulus interval. */
  stimulusEndSuffix?: string
  /** Present when URLStart/URLEnd web-stimulus events define stimuli. */
  stimulusWeb?: true
}

export function parseTobiiUserInput(userInput: string): TobiiParsingConfig {
  if (userInput === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(userInput)
  } catch {
    throw new Error(`Invalid Tobii parsing config: ${userInput}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid Tobii parsing config: ${userInput}`)
  }
  return parsed as TobiiParsingConfig
}

/** Canonical spelling: keys present iff active; empty config is ''. */
export function serializeTobiiConfig(config: TobiiParsingConfig): string {
  const clean = Object.fromEntries(
    Object.entries(config).filter(
      ([, value]) => value !== undefined && value !== ''
    )
  )
  return Object.keys(clean).length === 0 ? '' : JSON.stringify(clean)
}

/** True when the config derives stimuli from Event rows (not media column). */
export function hasEventDrivenStimuli(config: TobiiParsingConfig): boolean {
  return Boolean(
    config.stimulusWeb || config.stimulusStartSuffix || config.stimulusEndSuffix
  )
}

/**
 * Tobii Pro Lab system events that never become event channels — recording
 * lifecycle, sync pulses, and web-navigation markers (the latter drive
 * web-stimulus parsing). Format-owned, not user config. Exact names,
 * compared byte-for-byte against the Event column.
 */
export const TOBII_SYSTEM_EVENTS: readonly string[] = [
  'RecordingStart',
  'RecordingEnd',
  'RecordingPause',
  'RecordingResume',
  'SyncPortInHigh',
  'SyncPortInLow',
  'SyncPortOutHigh',
  'SyncPortOutLow',
  'TTLIn',
  'TTLOut',
  'URLStart',
  'URLEnd',
]
