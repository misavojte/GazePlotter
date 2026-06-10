/**
 * VOCABULARY GUARD — the ingest glossary is load-bearing.
 *
 * `src/lib/data/ingest/README.md` defines seven nouns (Source, Probe,
 * Format, Registry, Sink, Job, Result) and bans the five words the
 * pre-refactor code used interchangeably for them. Synonyms are a retrieval
 * hazard: four names for one concept quadruples the chance a search (by a
 * human or an LLM) lands in the wrong neighborhood. This test keeps the
 * banned words from creeping back into `src/lib/data/ingest/`.
 *
 * Scope: TypeScript sources only (the README necessarily names the banned
 * words to ban them). Frozen user-facing strings are exempt — they predate
 * the glossary and must never change (see ALLOWED below).
 */

import { describe, expect, test } from 'vitest'

const sources = import.meta.glob('../src/lib/data/ingest/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const BANNED = /adapter|deserializer|reducer|pipeline|classifier/i

/** Frozen user-facing strings that legitimately contain a banned word. */
const ALLOWED: ReadonlyArray<{ file: RegExp; line: RegExp }> = [
  {
    // Pre-refactor parse error, pinned by RowParser tests — frozen surface.
    file: /\/formats\/lib\/rows\/RowParser\.ts$/,
    line: /Invalid data file for \$\{this\.constructor\.name\} deserializer/,
  },
]

describe('ingest vocabulary', () => {
  test('banned words (adapter, deserializer, reducer, pipeline, classifier) do not appear in src/lib/data/ingest', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20) // glob sanity
    const violations: string[] = []
    for (const [file, content] of Object.entries(sources)) {
      content.split('\n').forEach((line, i) => {
        if (!BANNED.test(line)) return
        if (ALLOWED.some(a => a.file.test(file) && a.line.test(line))) return
        violations.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
    expect(violations).toEqual([])
  })
})
