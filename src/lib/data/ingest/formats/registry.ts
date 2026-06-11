/**
 * THE format registry. One entry per supported input format.
 *
 * ADDING A NEW FORMAT
 *   1. Create `formats/<vendor>.ts` — for row-oriented text exports use
 *      `defineRowFormat` (detection sniff + delimiter + RowParser factory);
 *      for bundles implement `ArchiveFormatDefinition`.
 *   2. Insert it into the matching list below, AT THE RIGHT SPECIFICITY
 *      POSITION (see ordering rules), and nothing else — detection, the UI,
 *      persistence, and the worker all derive from this file.
 *
 * ORDERING RULES (STREAM_FORMATS order IS the detection contract):
 *   - First `detect()` that resolves wins, so MORE SPECIFIC sniffs must
 *     come BEFORE weaker ones. Pinned by tests/ingestRegistry.test.ts:
 *       · csv-segmented-duration before csv-segmented before csv
 *         (each is a superset sniff of the next);
 *       · varjo last among vendors — its sniff ('Time' + 'Actor Label')
 *         is weak enough to shadow the csv family but lose to vendors.
 *   - Type ids are persisted in workspace files (parseSettings.type):
 *     APPEND-ONLY — never rename or reuse an existing id.
 */
import type {
  ArchiveFormatDefinition,
  EnrichmentFormatDefinition,
  StreamFormatDefinition,
  WorkspaceFormatDefinition,
} from '../kernel/format'
import { buildParseSettings } from '../kernel/format'
import type { FormatRegistry } from '../kernel/job'
import { detectStreamFormat } from '../kernel/job'
import type { SourceProbe } from '../kernel/source'
import type { ParseSettings } from '../types'
import { tobiiFormat } from './tobii'
import { gazePointFormat } from './gazepoint'
import { beGazeFormat } from './begaze'
import { ogamaFormat } from './ogama'
import { varjoFormat } from './varjo'
import { csvFormat } from './csv'
import { csvSegmentedFromToFormat } from './csvSegmentedFromTo'
import { csvSegmentedDurationFormat } from './csvSegmentedDuration'
import { pupilCloudZipFormat } from './pupilCloudZip'
import { workspaceJsonFormat } from './workspaceJson'
import { csvEventFormat } from './csvEvent'
import { legacyEventsFormat } from './legacyEvents'

export const STREAM_FORMATS: readonly StreamFormatDefinition[] = [
  tobiiFormat,
  gazePointFormat,
  beGazeFormat,
  ogamaFormat,
  varjoFormat,
  csvSegmentedDurationFormat,
  csvSegmentedFromToFormat,
  csvFormat,
]

export const ARCHIVE_FORMATS: readonly ArchiveFormatDefinition[] = [
  pupilCloudZipFormat,
]

export const WORKSPACE_FORMATS: readonly WorkspaceFormatDefinition[] = [
  workspaceJsonFormat,
]

/**
 * Event-file formats, claimed during the main-thread upload partition and
 * consumed AFTER the dataset exists (never by the worker job). Checked
 * BEFORE stream detection — an event file must not fall through to a
 * gaze format. Order within the list follows the usual specificity rule.
 */
export const ENRICHMENT_FORMATS: readonly EnrichmentFormatDefinition[] = [
  csvEventFormat,
  legacyEventsFormat,
]

/** First enrichment format claiming the probe, or null. */
export function detectEnrichmentFormat(
  probe: SourceProbe
): EnrichmentFormatDefinition | null {
  for (const def of ENRICHMENT_FORMATS) {
    if (def.detect(probe)) return def
  }
  return null
}

/** The registry handed to `IngestJob` in production. */
export const FORMAT_REGISTRY: FormatRegistry = {
  stream: STREAM_FORMATS,
  archive: ARCHIVE_FORMATS,
  workspace: WORKSPACE_FORMATS,
}

/**
 * Every type id a parsed file can carry in `parseSettings.type`, plus
 * 'unknown' for undetectable content. Derived — adding a format extends
 * this union automatically.
 */
export type FormatTypeId =
  | (typeof STREAM_FORMATS)[number]['ids'][number]
  | (typeof ARCHIVE_FORMATS)[number]['id']
  | 'unknown'

/** Stream format owning the given persisted type id, if any. */
export function getStreamFormat(
  typeId: string
): StreamFormatDefinition | undefined {
  return STREAM_FORMATS.find(def => def.ids.includes(typeId))
}

/**
 * Resolve the probe's type id against the registry, or 'unknown'.
 * Convenience over `detectStreamFormat` for diagnostics and tests.
 */
export function detectTypeId(probe: SourceProbe): FormatTypeId {
  return (detectStreamFormat(STREAM_FORMATS, probe)?.typeId ??
    'unknown') as FormatTypeId
}

/**
 * Detect the probe's stream format and assemble its `ParseSettings`
 * (without user input — the job adds that after prompting).
 * @throws Error('Unknown file type') when no format claims the probe.
 */
export function classifyProbe(probe: SourceProbe): ParseSettings {
  const match = detectStreamFormat(STREAM_FORMATS, probe)
  if (!match) throw new Error('Unknown file type')
  return buildParseSettings(match.def, match.typeId, probe, '')
}
