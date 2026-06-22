---
name: gazeplotter-docs
description: Conventions for the user-facing documentation served at /docs. MUST use when modifying anything under docs/ or adding a feature that needs documentation.
---

# GazePlotter Docs

The top-level `docs/` tree is markdown rendered and served at the `/docs` route (`import.meta.glob('/docs/**/*.md')` in `src/routes/docs/docs.ts`). It is the user-facing source of truth.

## Structure

Real top-level pillars: `setup/`, `upload-data/`, `metrics/`, `visualizations/`, `export/`, `advanced/` (plus `index.md`).

- Plot/visualization pages live in `docs/visualizations/` (e.g. `scarf-plot.md`). There is no `docs/basic/`; old `basic/*` slugs are 308-redirected via the REDIRECTS map in `src/routes/docs/[...slug]/+page.ts`.
- Data-format pages live in `docs/upload-data/`.

## DOs

- Mirror exact UI labels case-sensitively and in bold: if the UI says **Stimulus**, write **Stimulus**, not "the stimulus button".
- Update docs in the same change as the code: a new plot needs a `docs/visualizations/<plot>.md`; a new or changed ingest format needs the matching `docs/upload-data/<format>.md`.
- Callouts use the `> **Bold Title**: Content` blockquote syntax.
- Screenshots use the `/docs/images/...` path (assets live in `static/docs/images/`).
- Internal links use absolute `/docs/...` paths.
- Document format constraints precisely against the parser. Format parsers live in `src/lib/data/ingest/formats/` (e.g. `csvSegmentedDuration.ts`, `tobii.ts`); if the docs state required headers or segmentation rules, the parser must enforce them. Headers vary by format (e.g. the time-series custom CSV uses `Time, Participant, Stimulus, AOI` per `docs/upload-data/custom-csv.md`), so do not state one header set as universal.

## DONTs

- No fuzzy UI descriptions and no conversational fluff; use clinical, senior-level technical writing.
- Do NOT use `:::` custom blocks or `#` headers inside callouts.
- Do NOT invent a parameter table from memory. Plot setting defaults come from each plot's `getDefaultSettings` (plus `getDefaultHeight`/`getDefaultWidth`/`getMinSize`) in `src/lib/plots/<plot>/definition.ts` via `definePlot`. They are NOT in `registry.ts`, and there is no `getDefaultConfig`.

## Page metadata

A page's title and description in the `/docs` route come from the `SIDEBAR` config in `src/routes/docs/sidebarConfig.ts` (read by `getDoc` in `docs.ts`), matched by href, NOT from YAML frontmatter. Frontmatter is inconsistent across the corpus and does not drive rendered metadata; when adding a page, add its `SIDEBAR` entry.
