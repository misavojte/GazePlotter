# Ingest pipeline performance baseline (Phase 0)

Reference numbers for the ingest v2 refactor. Re-run `npm run bench` after
each refactor phase and compare against this table. **Budget: mean within
±5% of baseline.** A regression beyond that blocks the phase until explained
or fixed.

Recorded before any refactor work (branch `1-9-0`), 2026-06-10.
Machine: Windows 10 Enterprise 10.0.19045, Node via vitest 1.6.1.
Numbers are machine-specific — if benchmarking on different hardware,
re-record this baseline from the pre-refactor commit first.

| Benchmark | mean | hz | rme | samples |
| --- | --- | --- | --- | --- |
| csv 120k rows → DataType | 203.85 ms | 4.91 | ±4.15% | 15 |
| tobii-with-event ~33k rows → DataType | 39.00 ms | 25.64 | ±5.24% | 77 |

Workloads are defined in `tests/ingestPipeline.bench.ts`:
- **csv**: synthetic 4 stimuli × 25 participants × 1200 rows, generic
  compiled row parser + byte dictionaries.
- **tobii**: the real `TobiiAdapter.test.data` body repeated ×200,
  interval-based media parsing (`IntervalStart;IntervalEnd`), AOI-hit columns.
