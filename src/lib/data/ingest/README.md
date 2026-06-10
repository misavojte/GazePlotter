# Ingest

**A Job probes Sources, the Registry's first matching Format reads them into
the Sink, and the Result is a dataset or a workspace.**

That sentence is the whole architecture. Everything in this directory is one
of those nouns:

| Noun         | What it is                                                        | Where                 |
| ------------ | ----------------------------------------------------------------- | --------------------- |
| **Source**   | Named one-shot byte stream coming in (a dropped file, a buffer)   | `kernel/source.ts`    |
| **Probe**    | The first chunk of a source, decoded — all that detection may see | `kernel/source.ts`    |
| **Format**   | Self-contained module that detects its files and reads them       | `formats/*.ts`        |
| **Registry** | The ordered list of all formats — order IS the detection contract | `formats/registry.ts` |
| **Sink**     | Typed dataset contributions out (segments now, events next)       | `kernel/sink.ts`      |
| **Job**      | One upload: probe → detect → read → finalize                      | `kernel/job.ts`       |
| **Result**   | `{ kind: 'dataset' }` or `{ kind: 'workspace' }` envelope         | `kernel/result.ts`    |

Reading order for a newcomer: this file → `kernel/format.ts` → any small
format (`formats/csv.ts`) → `formats/registry.ts`. That is full competence
for adding a format; open `kernel/job.ts` only when changing orchestration.

## Vocabulary

The five banned words are **adapter, deserializer, reducer, pipeline,
classifier** — pre-refactor code used all five for overlapping concepts,
which made retrieval (by humans and LLMs alike) unreliable. They must not
reappear in this directory; a guard test (`tests/ingestVocabulary.test.ts`)
enforces it. The replacement for all of them: a **format** detects, and its
**RowParser** (for row-oriented text) parses.

## Adding a format

1. Create `formats/<vendor>.ts`:
   - Row-oriented text export → call `defineRowFormat` with a `detect`
     sniff, a column delimiter, and a `createRowParser` factory (a
     `RowParser` subclass in `formats/lib/rows/`). See `formats/csv.ts`
     (smallest) or `formats/tobii.ts` (prompt + variants).
   - Binary bundle → implement `ArchiveFormatDefinition` (claimed by file
     name, receives all its files as buffers in one call). See
     `formats/pupilCloudZip.ts`.
2. Add it to the matching list in `formats/registry.ts`, at the right
   specificity position. Done — detection, the worker, persistence, and the
   UI all derive from the registry.

If the format needs user input mid-parse, declare a `promptId` and register
the modal in `prompts.ts` (main thread); the worker protocol never changes.

**Companion files** (a vendor exporting `data.csv` + `meta.json` that only
make sense together): write a `detect` that recognizes _both_ shapes and
sort them out inside `read` — the job hands a format every source it
claimed. Pupil already works this way (every zip detects as pupil; `read`
iterates). No grouping machinery exists or is needed in the kernel.

**Future contribution kinds** (marker/event streams from non-gaze
instruments, e.g. EEG triggers): produce them via `sink.addEvent` — the
sink, not the format contract, is the seam that grows.

## Invariants

1. **Registry order is semantic.** First `detect()` win decides — more
   specific sniffs must precede weaker ones (`csv-segmented-duration` before
   `csv-segmented` before `csv`; `varjo` last among vendors). Pinned by
   `tests/ingestRegistry.test.ts`.
2. **Type ids are append-only.** `parseSettings.type` values are persisted
   inside saved workspace JSON. Never rename or reuse one.
3. **No allocation per row.** Hot loops (RowSplitter, RowParsers, the
   segment writer's byte dictionaries) work on `Uint8Array` subarrays and
   bound function refs; kernel indirection happens per file and per chunk
   only. Benchmark budget: ±5% vs `tests/ingestBenchmark.baseline.md`.
4. **Prompts are sequential.** The job reads sources one at a time, so at
   most one `IngestContext.prompt` is pending — prompt implementations may
   rely on it. Cancel resolves with the prompt's declared `cancelValue`.

## Policy: mixed uploads

If the FIRST file of an upload is a workspace file, it is the entire result
and every other file is ignored — the historical "first-file-wins" JSON
rule, kept deliberately as an explicit rule (characterized in
`tests/ingestCharacterization.routing.test.ts`). Otherwise archive files are
read first as one group, then stream files sequentially in upload order
(dictionary ids are assigned first-seen, so order is observable).

## Hosts

The kernel never imports the worker, the DOM, or Svelte. `worker.ts` is a
thin message bridge that wires `IngestContext` to `postMessage`;
characterization tests run the same `IngestJob` in-process. The main-thread
side lives in `service.svelte.ts` (send sources, apply the Result,
post-load event enrichment of an already-loaded dataset — the one flow that
stays on the main thread because it needs the live engine and an
interactive mapping modal).
