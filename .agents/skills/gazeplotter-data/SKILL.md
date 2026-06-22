---
name: gazeplotter-data
description: Ingest pipeline, the binary segment/AOI/event store and its readers, and the data engine's reactivity boundary in GazePlotter. MUST use when modifying anything under src/lib/data (format parsers, the binary store/readers, or the engine).
---

# GazePlotter Data Engine & Ingest

This is the most performance-sensitive code in the repo: datasets reach ~10GB and parse on a worker. Treat allocations and copies as the primary cost. The file:line anchors are the source of truth.

## Ingest pipeline (worker)

- Ingest runs in `src/lib/data/ingest/worker.ts` (entry `self.onmessage`, :92). It cannot touch the session or UI; on failure it posts `{ type: 'fail', data: error }` (:153) and the main-thread ingest service handles `case 'fail'` (`service.svelte.ts:446`). The reporting side is the gazeplotter-session-boundaries skill.
- Format detection is content-based: `detectStreamFormat` returns the first format whose `detect(probe)` is non-null, and the ORDER of `STREAM_FORMATS` in `formats/registry.ts` is specificity (Tobii first, plain csv last). Add a format by inserting it at the right specificity, not by special-casing callers. `formats/routing.ts` only decides archive vs stream (`isArchiveFileName`).
- All row formats share one spine: `formats/lib/rows/defineRowFormat.ts` -> `RowSplitter` -> per data row `parser.processRowBytes`, with `parser.onSegment = sink.addSegmentBytes`. A vendor format implements a `RowParser` (`formats/lib/rows/`), not its own file loop.

## Hot-path discipline (parse + sink)

- The per-row parser is a single-pass JIT byte scanner (`binaryRowParser` in `RowParser.ts`, built once via `new Function`): no `split()`/`indexOf()`, slices only needed columns, reuses typed scratch arrays. Do not add per-row allocations, string ops, or array building.
- Work per bucket, not per row. Segments are interned per (stimulus, participant) into `buckets[sIdx][pIdx]` (`ingest/kernel/segmentWriter.ts`), a `SegmentBucket` of packed typed arrays (`data: Float64Array` stride-3 [start,end,category], flattened AOI arrays). Aggregate and validate at bucket/group level.
- Do not make a second copy of segment bytes. `buildFinalData` emits the packed `segmentBuffer`/`indexTable`/`aoiPool`, and those are TRANSFERRED (not copied) out of the worker (`worker.ts:74-81`).
- Bound the count of simultaneously-live objects to a constant and reuse scratch buffers. Do not trust allocation microbenchmarks at this scale.

## Binary store and readers (non-reactive)

- The binary buffers are plain typed arrays held OUTSIDE `$state` in `DataEngine` (`_binary`, `_reader`, `_aoiGroupReader`, `_eventReader`; `dataEngine.svelte.ts:20-23`) to avoid proxy overhead. Keep big buffers out of runes.
- Read through readers obtained from the engine: `getReader()` -> `BinaryBufferReader` (segments; raw `segmentBufferRaw`, `SEGMENT_STRIDE = 6` and `SegmentField` in `binary/schema.ts`), `getAoiGroupReader()` -> `AoiGroupReader` (`HIDDEN_ID = 0xffff`, zero-alloc `getSegmentAoisIntoUniqueTyped`), `getEventReader()` -> `EventBufferReader` (`getOccurrences(stimulusId, channelId, participantId)` returns a stride-2 `[start,duration,...]` view, `EVENT_STRIDE = 2`).
- Build buffers with `jsonSegmentsToBinary` (`binary/converters.ts`) and `jsonEventsToBinary` (`binary/reader.event.ts`). There is no GrowBuffer.
- NEVER read `eventData.events` (the legacy `number[][][][]`) in a render or transform path; it is read only by ingest (`dataEngine.svelte.ts:71`) and the export mapper (`export/mappers/events.ts:107`).

## Reactivity and data epoch

- The engine's reactive surface is `metadata = $state` (light defs/order/hidden only) and `eventVersion = $state(0)` (`dataEngine.svelte.ts:26,36`). `eventVersion` bumps on event-buffer load and `updateEventDataBatch`. Reactive consumers do `void this.eventVersion` to take the dependency, then read through the non-reactive reader.
- Channel def/order/hidden edits flow through `metadata.eventData` and need NO bump. (The plot-item `redrawTimestamp` is a separate, plot-layer signal; see the gazeplotter-plot skill.)

## Events are immutable; derive additively

- Imported binary occurrence/segment buffers are immutable; read them, do not rewrite them.
- Event interval channels are DERIVED ADDITIVELY in `engine/eventIntervals.ts` (`buildEventDataWithIntervalChannels`; bulk suffix proposals via `proposePairsBySuffix`/`detectSuffixPair`; `previewIntervalDrafts`). Derivation only APPENDS channels (tagged `INTERVAL_CHANNEL_MARKER = 'interval'`); the originals stay visible.
- Strict vs lenient is a UI policy (`create-intervals`), not a module concern; pass only clean drafts for strict semantics. Commands stay plain `updateEventData` (-> `updateEventDataBatch`, which rebuilds the reader and bumps `eventVersion`).

## Interval-stimulus (Tobii) robustness

- Validate intervals per (interval, participant) group: `pairIntervalTimes` (`$lib/data/intervalPairing`) pairs starts/ends; clean groups commit, others are excluded together (segments + events + orphan AOIs) via provisional-group gating: the parser's `gateGroup` (`TobiiRowParser.ts`) drives `beginProvisionalGroup`/`commitProvisionalGroup`/`dropProvisionalGroup` on the sink (`segmentWriter.ts`, states `BUCKET_AUTO`/`BUCKET_PROVISIONAL`/`BUCKET_COMMITTED`). Invalid groups are dropped in `buildFinalData`, with no byte re-matching.
- The open-segment fast-path merge MUST guard participant identity (sample and stimulus key match) so a reused interval index never bleeds gaze+AOI across a recording boundary (`TobiiRowParser.ts`). Absent slots use the `EMPTY_KEY = -1` sentinel.

## Verify

In-code only: `npm run check` (svelte-check) and `npm test` (vitest); ingest has bench coverage (`npm run bench`). Do not start a dev server to verify.
