import type { DataEngine } from '$lib/data/engine/dataEngine.svelte'
import { getAois, getParticipantsIds } from '$lib/data/engine'
import {
  aoiLetterIndexOf,
  collectAllScanpaths,
} from '$lib/metrics/core/scanpathEncoding'

/**
 * ScanGraph TXT in OGAMA's "Similarity Measurements" layout: one row per
 * participant with an AOI-letter scanpath. Strings come from the same encoder
 * the Scanpath Similarity metric uses (fixations only, first selected AOI,
 * merge-aware letters), so the file matches what the app itself analyses.
 * The `# Contents:` line makes the file re-ingestable as OGAMA format; the
 * column header must stay at row index 8 for that ingest to find it.
 */
export function generateScanGraph(
  engine: DataEngine,
  stimulusId: number,
  collapsed: boolean
): string {
  const meta = engine.metadata
  if (!meta || !engine.getReader() || !engine.getAoiGroupReader()) {
    throw new Error('Data engine not ready for ScanGraph export')
  }

  const aois = meta.aois.data[stimulusId] ? getAois(engine, stimulusId) : []
  // The same "All" selector the similarity metric path uses: order-vector
  // driven, so merged-away participants don't export as ghost rows.
  const participantIds = getParticipantsIds(engine, -1, stimulusId)
  const entries = collectAllScanpaths(
    engine,
    stimulusId,
    participantIds,
    aois,
    collapsed
  )

  const usedLetters = new Set<string>()
  for (const e of entries) {
    for (const ch of e.scanpath) if (ch !== '#') usedLetters.add(ch)
  }
  const aoiKey = [...usedLetters]
    .sort()
    .map(l => `${l} = ${aois[aoiLetterIndexOf(l)]?.displayedName ?? ''}`)

  // CRLF throughout: the ingest's row splitter honors ONE detected delimiter,
  // so a mixed-endings file would fold the header block into a single row.
  const lines = [
    '# Contents: Similarity Measurements of scanpaths.',
    '#',
    '#',
    '# Key:',
    `# # = no fixation, ${aoiKey.join(', ')}`,
    '#',
    '# The following part is the sequence similarity of the scanpaths',
    '#',
    'Sequence Similarity\tScanpath string',
    ...entries.map(e => `${e.label}\t${e.scanpath}`),
  ]
  return lines.join('\r\n') + '\r\n'
}
