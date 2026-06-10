import JSZip from 'jszip'
import type { ArchiveFormatDefinition } from '../kernel/format'
import type { DatasetSink } from '../kernel/sink'
import type { ParseSettings } from '../types'

/**
 * Pupil Cloud ZIP export. Each ZIP is one stimulus (named after the ZIP
 * file); participants and AOIs accumulate across ZIPs, so a multi-ZIP
 * upload is ONE dataset — which is why archive formats receive all their
 * sources in a single `read` call.
 */
export const pupilCloudZipFormat: ArchiveFormatDefinition = {
  kind: 'archive',
  id: 'pupil-cloud-zip',
  displayName: 'Pupil Cloud',
  matchesFileName: name => name.toLowerCase().endsWith('.zip'),

  async read(inputs, sink, ctx) {
    for (const input of inputs) {
      const zip = await JSZip.loadAsync(input.bytes)
      const [sectionsCsv, aoiFixationsCsv, fixationsCsv] = await Promise.all([
        readZipText(zip, 'sections.csv'),
        readZipText(zip, 'aoi_fixations.csv'),
        readZipText(zip, 'fixations.csv'),
      ])

      const fixationToAoi = buildFixationToAoiMap(aoiFixationsCsv)
      const recordingToParticipant = buildRecordingToParticipantMap(sectionsCsv)
      const stimulus = deriveStimulusFromZipName(input.name)

      addFixationsToSink({
        sink,
        fixationsCsv,
        stimulus,
        fixationToAoi,
        recordingToParticipant,
      })

      // Whole-zip progress unit; force past the host's throttle.
      ctx.reportBytes(input.bytes.byteLength, true)
    }

    const settings: ParseSettings = {
      type: 'pupil-cloud-zip',
      rowDelimiter: '\n',
      columnDelimiter: ',',
      encoding: 'utf-8',
      userInputSetting: '',
      headerRowId: 0,
    }
    return { settings }
  },
}

/**
 * Reads a text file from a JSZip archive by partial filename match (case-insensitive).
 *
 * @param zip - Loaded JSZip instance
 * @param namePart - Substring to identify the entry (e.g., 'sections.csv')
 * @throws If no matching file is found or the entry is a directory
 */
export async function readZipText(
  zip: JSZip,
  namePart: string
): Promise<string> {
  const key = Object.keys(zip.files).find(k =>
    k.toLowerCase().includes(namePart.toLowerCase())
  )
  if (!key) throw new Error(`Missing ${namePart} in ZIP`)
  const file = zip.files[key]
  if (file.dir) throw new Error(`${namePart} is a directory, expected a file`)
  return await file.async('text')
}

/**
 * Builds Map<compositeKey, Set<AOI name>> from `aoi_fixations.csv`.
 * Expected columns:
 * [0] aoi id, [1] aoi name, [2] section id, [3] recording id, [4] fixation id, [5] fixation duration [ms]
 *
 * The key is a composite of recordingId and fixationId (format: "recordingId:fixationId")
 * because fixation IDs are only unique within a recording, not globally.
 *
 * @param csv - The CSV content as UTF-8 string
 * @returns Immutable Map keyed by composite "recordingId:fixationId" with a Set of AOI names
 */
export function buildFixationToAoiMap(
  csv: string
): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>()
  forEachCsvRow(csv, (cols, isHeader) => {
    if (isHeader) return
    const aoiName = cols[1]
    const recordingId = cols[3]
    const fixationId = cols[4]
    if (!recordingId || !fixationId) return
    // Create composite key: recordingId:fixationId
    const compositeKey = `${recordingId}:${fixationId}`
    const set =
      map.get(compositeKey) ??
      map.set(compositeKey, new Set<string>()).get(compositeKey)!
    if (aoiName) set.add(aoiName)
  })
  return map
}

/**
 * Builds Map<recordingId, participantName> from `sections.csv`, where participantName is "recording name".
 * Expected columns:
 * [0] section id, [1] recording id, [2] recording name, ...
 *
 * Recording names often have timestamp suffixes (e.g., "T4a_AZ_ZP_2025-04-17_11:16:45").
 * This function intelligently strips the timestamp pattern if doing so maintains uniqueness.
 *
 * @param csv - The CSV content as UTF-8 string
 * @returns Immutable Map keyed by recordingId with recordingName value
 */
export function buildRecordingToParticipantMap(
  csv: string
): ReadonlyMap<string, string> {
  const rawMap = new Map<string, string>()

  // First pass: collect all raw recording names
  forEachCsvRow(csv, (cols, isHeader) => {
    if (isHeader) return
    const recordingId = cols[1]
    const recordingName = cols[2]
    if (recordingId && recordingName) rawMap.set(recordingId, recordingName)
  })

  // Try to strip timestamp pattern and check if names remain unique
  const strippedNames = new Map<string, string>()
  for (const [recordingId, recordingName] of rawMap.entries()) {
    const stripped = stripTimestampFromRecordingName(recordingName)
    strippedNames.set(recordingId, stripped)
  }

  // Check uniqueness of stripped names
  const uniqueStripped = new Set(strippedNames.values())
  const useStripped = uniqueStripped.size === strippedNames.size

  return useStripped ? strippedNames : rawMap
}

/**
 * Strips timestamp pattern from Pupil Cloud recording names.
 * Pattern: _YYYY-MM-DD_HH:MM:SS at the end of the name
 *
 * Examples:
 * - "T4a_AZ_ZP_2025-04-17_11:16:45" → "T4a_AZ_ZP"
 * - "V4e_AS_ZP_2025-03-21_09:53:38" → "V4e_AS_ZP"
 *
 * @param recordingName - Original recording name with timestamp
 * @returns Recording name with timestamp stripped if pattern matches, otherwise original
 */
export function stripTimestampFromRecordingName(recordingName: string): string {
  // Pattern: _YYYY-MM-DD_HH:MM:SS at the end
  const timestampPattern = /_\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/
  return recordingName.replace(timestampPattern, '')
}

/**
 * Derives stimulus name from the ZIP file name by removing the `.zip` suffix (case-insensitive).
 *
 * @param zipName - Original ZIP file name
 * @returns Stimulus name
 */
export function deriveStimulusFromZipName(zipName: string): string {
  return zipName.replace(/\.zip$/i, '')
}

/**
 * Adds fixation data from CSV to the dataset sink.
 * Expected fixations columns:
 * [0] section id, [1] recording id, [2] fixation id, [3] start timestamp [ns], [4] end timestamp [ns], ...
 *
 * - Per-participant time normalization: first seen fixation start per participant becomes time=0
 * - AOIs per fixation looked up via `fixationToAoi`
 * - Participant resolved via `recordingToParticipant` map (fallback to recordingId if unknown)
 * - Each ZIP/stimulus has its own time base per participant
 *
 * @param params - Sink, CSV data, and lookup maps
 */
export function addFixationsToSink(params: {
  sink: Pick<DatasetSink, 'addSegment'>
  fixationsCsv: string
  stimulus: string
  fixationToAoi: ReadonlyMap<string, ReadonlySet<string>>
  recordingToParticipant: ReadonlyMap<string, string>
}): void {
  const {
    sink,
    fixationsCsv,
    stimulus,
    fixationToAoi,
    recordingToParticipant,
  } = params

  // Time base is per-participant AND per-stimulus to ensure each stimulus starts at 0
  const baseByParticipant = new Map<string, number>()

  forEachCsvRow(fixationsCsv, (cols, isHeader) => {
    if (isHeader) return
    const recordingId = cols[1]
    const fixationId = cols[2]
    const startNs = Number(cols[3])
    const endNs = Number(cols[4])

    if (
      !recordingId ||
      !fixationId ||
      !Number.isFinite(startNs) ||
      !Number.isFinite(endNs)
    )
      return

    const participant = recordingToParticipant.get(recordingId) ?? recordingId

    // Each stimulus has its own time base per participant
    if (!baseByParticipant.has(participant))
      baseByParticipant.set(participant, startNs)
    const baseNs = baseByParticipant.get(participant)!
    const startMs = (startNs - baseNs) / 1e6
    const endMs = (endNs - baseNs) / 1e6

    // Create composite key to match the buildFixationToAoiMap format
    const compositeKey = `${recordingId}:${fixationId}`
    const aoiSet = fixationToAoi.get(compositeKey) ?? null
    const aoiArray = aoiSet ? Array.from(aoiSet) : null

    sink.addSegment({
      stimulus,
      participant,
      start: String(startMs),
      end: String(endMs),
      category: 'Fixation',
      aoi: aoiArray,
    })
  })
}

/**
 * Iterates CSV rows (simple, non-quoted format) and calls `fn` with parsed columns.
 * Skips empty lines; first non-empty line is treated as header.
 *
 * @param csv - CSV string (LF or CRLF)
 * @param fn - Callback receiving [columns, isHeader]
 */
export function forEachCsvRow(
  csv: string,
  fn: (cols: string[], isHeader: boolean) => void
): void {
  let start = 0
  let isHeader = true
  for (let i = 0; i < csv.length; i++) {
    if (csv.charCodeAt(i) === 10 /* \n */) {
      const line = csv.slice(start, i).replace(/\r$/, '')
      start = i + 1
      if (line.length === 0) continue
      fn(line.split(','), isHeader)
      isHeader = false
    }
  }
  if (start < csv.length) {
    const line = csv.slice(start).replace(/\r$/, '')
    if (line.length > 0) fn(line.split(','), isHeader)
  }
}
