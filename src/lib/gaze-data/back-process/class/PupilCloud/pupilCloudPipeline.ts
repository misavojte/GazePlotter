import JSZip from 'jszip'
import type { DataType } from '$lib/gaze-data/shared/types'
import type { EyeSettingsType } from '$lib/gaze-data/back-process/types/EyeSettingsType'
import { EyeWriter } from '$lib/gaze-data/back-process/class/EyeWriter/EyeWriter'
import { EyeRefiner } from '$lib/gaze-data/back-process/class/EyeRefiner/EyeRefiner'

/**
 * Stateful pipeline for processing multiple Pupil Cloud ZIP files.
 * Maintains a shared EyeWriter instance to accumulate data from multiple ZIPs,
 * where each ZIP represents a different stimulus but may share participants.
 */
export class PupilCloudPipeline {
  private writer: EyeWriter = new EyeWriter()
  private zipNames: string[] = []
  private zipCount = -1
  private completeSettings: EyeSettingsType | null = null

  /**
   * Checks if all ZIP files have been processed.
   */
  get isAllProcessed(): boolean {
    return this.zipCount === this.zipNames.length - 1
  }

  /**
   * Creates a new pipeline instance for processing multiple ZIP files.
   *
   * @param zipNames - Array of ZIP file names to process
   */
  constructor(zipNames: string[]) {
    this.zipNames = zipNames
  }

  /**
   * Processes a single Pupil Cloud ZIP file and adds its data to the shared writer.
   * Returns the complete dataset only after all ZIPs have been processed.
   *
   * @param zipBytes - Raw ZIP bytes
   * @param zipName - Original ZIP file name (used to derive stimulus)
   * @returns Parsed data and settings if all files processed, null otherwise
   */
  async addNewZip(
    zipBytes: Uint8Array,
    zipName: string
  ): Promise<{ data: DataType; settings: EyeSettingsType } | null> {
    console.log(`[PupilCloudPipeline] Processing ZIP ${this.zipCount + 1}/${this.zipNames.length}: ${zipName}`)
    
    const zip = await JSZip.loadAsync(zipBytes)
    const [sectionsCsv, aoiFixationsCsv, fixationsCsv] = await Promise.all([
      readZipText(zip, 'sections.csv'),
      readZipText(zip, 'aoi_fixations.csv'),
      readZipText(zip, 'fixations.csv'),
    ])

    const fixationToAoi = buildFixationToAoiMap(aoiFixationsCsv)
    const recordingToParticipant = buildRecordingToParticipantMap(sectionsCsv)
    const stimulus = deriveStimulusFromZipName(zipName)

    // Add data from this ZIP to the shared writer
    // Each ZIP is a separate stimulus, but participants/AOIs accumulate
    addFixationsToWriter({
      writer: this.writer,
      fixationsCsv,
      stimulus,
      fixationToAoi,
      recordingToParticipant,
    })

    this.zipCount++

    // Store settings from first ZIP (all should be the same type)
    if (this.completeSettings === null) {
      this.completeSettings = {
        type: 'pupil-cloud-zip',
        rowDelimiter: '\n',
        columnDelimiter: ',',
        userInputSetting: '',
        headerRowId: 0,
      }
    }

    console.log(`[PupilCloudPipeline] Completed ZIP ${this.zipCount}/${this.zipNames.length}, isAllProcessed: ${this.isAllProcessed}`)

    // Only return data when all ZIPs are processed
    if (this.isAllProcessed) {
      console.log('[PupilCloudPipeline] All ZIPs processed, applying refiner and returning data')
      const refiner = new EyeRefiner()
      return {
        data: refiner.process(this.writer.data),
        settings: this.completeSettings,
      }
    }

    console.log('[PupilCloudPipeline] Returning null, waiting for more ZIPs')
    return null
  }
}

/**
 * Reads a text file from a JSZip archive by partial filename match (case-insensitive).
 *
 * @param zip - Loaded JSZip instance
 * @param namePart - Substring to identify the entry (e.g., 'sections.csv')
 * @throws If no matching file is found or the entry is a directory
 */
export async function readZipText(zip: JSZip, namePart: string): Promise<string> {
  const key = Object.keys(zip.files).find(k => k.toLowerCase().includes(namePart.toLowerCase()))
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
export function buildFixationToAoiMap(csv: string): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>()
  forEachCsvRow(csv, (cols, isHeader) => {
    if (isHeader) return
    const aoiName = cols[1]
    const recordingId = cols[3]
    const fixationId = cols[4]
    if (!recordingId || !fixationId) return
    // Create composite key: recordingId:fixationId
    const compositeKey = `${recordingId}:${fixationId}`
    const set = map.get(compositeKey) ?? (map.set(compositeKey, new Set<string>()).get(compositeKey)!)
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
export function buildRecordingToParticipantMap(csv: string): ReadonlyMap<string, string> {
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
  
  console.log(`[PupilCloud] Recording names: ${rawMap.size} total, stripped to ${uniqueStripped.size} unique names, using ${useStripped ? 'stripped' : 'original'} names`)
  
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
 * Adds fixation data from CSV to an existing EyeWriter instance.
 * Expected fixations columns:
 * [0] section id, [1] recording id, [2] fixation id, [3] start timestamp [ns], [4] end timestamp [ns], ...
 *
 * - Per-participant time normalization: first seen fixation start per participant becomes time=0
 * - AOIs per fixation looked up via `fixationToAoi`
 * - Participant resolved via `recordingToParticipant` map (fallback to recordingId if unknown)
 * - Each ZIP/stimulus has its own time base per participant
 *
 * @param params - Writer instance, CSV data, and lookup maps
 */
export function addFixationsToWriter(params: {
  writer: EyeWriter
  fixationsCsv: string
  stimulus: string
  fixationToAoi: ReadonlyMap<string, ReadonlySet<string>>
  recordingToParticipant: ReadonlyMap<string, string>
}): void {
  const { writer, fixationsCsv, stimulus, fixationToAoi, recordingToParticipant } = params
  
  // Time base is per-participant AND per-stimulus to ensure each stimulus starts at 0
  const baseByParticipant = new Map<string, number>()

  forEachCsvRow(fixationsCsv, (cols, isHeader) => {
    if (isHeader) return
    const recordingId = cols[1]
    const fixationId = cols[2]
    const startNs = Number(cols[3])
    const endNs = Number(cols[4])

    if (!recordingId || !fixationId || !Number.isFinite(startNs) || !Number.isFinite(endNs)) return

    const participant = recordingToParticipant.get(recordingId) ?? recordingId
    
    // Each stimulus has its own time base per participant
    if (!baseByParticipant.has(participant)) baseByParticipant.set(participant, startNs)
    const baseNs = baseByParticipant.get(participant)!
    const startMs = (startNs - baseNs) / 1e6
    const endMs = (endNs - baseNs) / 1e6

    // Create composite key to match the buildFixationToAoiMap format
    const compositeKey = `${recordingId}:${fixationId}`
    const aoiSet = fixationToAoi.get(compositeKey) ?? null
    const aoiArray = aoiSet ? Array.from(aoiSet) : null

    writer.add({
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
