# Ingest pipeline performance baseline

Reference numbers for ingest changes. Re-run `npm run bench` after each
phase and compare against this table. **Budget: mean within ±5% of
baseline** (noise band) — the kernel must add no per-row or per-chunk
overhead. When ambient noise exceeds the budget (rme above ~5%), do a
PAIRED run instead: stash the change, benchmark, pop, benchmark, compare
the pair recorded in the same session.

Recorded on branch `1-9-0`, 2026-06-11, against the post-refactor
`IngestJob` kernel (the bench harness was migrated from the deleted
`EyePipeline` API on this date — numbers are NOT comparable to the
pre-refactor table recorded under vitest 1.6.1).
Machine: Windows 10 Enterprise 10.0.19045, vitest 4.1.8.
Numbers are machine-specific — re-record when benchmarking elsewhere.

| Benchmark | mean | hz | rme | samples |
| --- | --- | --- | --- | --- |
| csv 120k rows → DataType | 302.79 ms | 3.30 | ±10.00% | 10 |
| tobii-with-event ~33k rows → DataType | 60.76 ms | 16.46 | ±7.35% | 51 |

Paired run for the keyed-JSON prompt config change (B1, 2026-06-11):
pre 59.68 ms vs post 60.76 ms on tobii (+1.8%, within budget); csv path
untouched (ran faster post-change inside its noise band).

Paired run for inline event extraction (B2, 2026-06-11): pre 57.94 ms vs
post 58.88 ms on tobii (mean +1.6%, min −3.5% — within budget). Event
handling is composed INTO the stimulus updater so an empty Event cell
costs exactly the baseline's one getBytes + length check; a first
implementation with a separate per-row event updater measured +8% and was
rejected. getBytes now returns a shared EMPTY_BYTES (allocation removed
from the per-row path).

Workloads are defined in `tests/ingestPipeline.bench.ts`:
- **csv**: synthetic 4 stimuli × 25 participants × 1200 rows, generic
  compiled row parser + byte dictionaries.
- **tobii**: the real `TobiiRowParser.test.data` body repeated ×200,
  interval-based media parsing (keyed-JSON stimulus suffixes), AOI-hit
  columns.
