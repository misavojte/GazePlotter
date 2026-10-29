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

## Visualization page layout

Plot pages (`docs/visualizations/<plot>.md`) are entry points: new users and LLMs land on them from search. Make them stand alone through substance about the plot, not through tool boilerplate. `scarf-plot.md` is the reference. Sections, in order:

1. `# <Plot name>` and a plain-language lede: what the plot shows and what it is for. No jargon in the first sentence; name a common synonym only if researchers really use it.
2. The workspace screenshot of the card, header included (`/docs/images/<plot>.webp`, 2x, from the demo data). Alt text names the stimulus and participants shown.
3. A short key/value table with an empty header row (`| | |` then `| --- | --- |`), plot-specific facts only: **Scope** (stimulus, participants), **Input** (what data it is built from), **Metric Library** (used or not, and how). No "Metric Contract" section.
4. A `> **Try it**:` callout only when the [demo workspace](/) shows this plot, saying what it shows.
5. `## When to Use It`: bold-led bullets, one research question each.
6. `## Reading the Plot`: bold-led bullets for axes, marks, colors, legend, as actually rendered (check the screenshot or the renderer).
7. `## Add a <Plot name>`: numbered steps (load data, **Add Visualization** > **<menu group>** > **<Plot name>** from `PLOT_GROUPS` in `src/lib/plots/groups.ts`, first pane choice), then one line linking [Plot Manipulation](/docs/workspace/#plot-manipulation) instead of a callout.
8. `## Settings`: the pane reference (see Parameter structure below).
9. `## Interactivity`, then any plot-specific deep sections (method, computation, Tobii comparison, reporting).
10. `## Related`: links to neighbouring plots, one clause each on how they differ.

No em dashes in new prose. Keep facts verifiable against the code; when a claim cannot be checked, leave it out.

Never repeat tool-level facts (free, open source, runs in the browser, privacy, the list of tracker formats, citation) on individual pages. Repeated boilerplate reads as SEO stuffing and is penalised by search engines and LLM retrieval alike. Those facts live once, on the docs index (`docs/index.md`) and in site-wide metadata.

## Parameter structure

Pane parameters are documented as a tree that mirrors the pane's dependency structure, never as a flat list with visibility qualifiers:

- One `###` per pane section, one bold bullet per control, in pane order; a control's option values are italic sub-bullets.
- A control shown only for one option value of another control (a `showWhen` in the definition) is nested UNDER that option value's bullet. Never write "(visible only when *X* is selected)": the nesting says it. One sentence at the top of the section may state that the mode picks the controls.
- One clause per control: what it does, with units, range, default, and the auto sentinel ("0 = Auto") inline. Don't repeat what the parent bullet already established.
- Verify the tree against the plot's `paneSections` in `src/lib/plots/<plot>/definition.ts` (field order, `group` captions, `showWhen`) before writing it.

## DONTs

- No fuzzy UI descriptions and no conversational fluff; use clinical, senior-level technical writing.
- Do NOT use `:::` custom blocks or `#` headers inside callouts.
- Do NOT invent a parameter table from memory. Plot setting defaults come from each plot's `getDefaultSettings` (plus the optional `size` field) in `src/lib/plots/<plot>/definition.ts` via `definePlot`. They are NOT in `registry.ts`, and there is no `getDefaultConfig`.

## Page metadata

A page's title and description in the `/docs` route come from the `SIDEBAR` config in `src/routes/docs/sidebarConfig.ts` (read by `getDoc` in `docs.ts`), matched by href, NOT from YAML frontmatter. Frontmatter is inconsistent across the corpus and does not drive rendered metadata; when adding a page, add its `SIDEBAR` entry.
