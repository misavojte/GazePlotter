---
description: Guidelines for maintaining and updating GazePlotter documentation. MUST use when modifying anything under docs/ or when adding new features that require documentation updates.
---

# GazePlotter Docs Guidelines

## DOs

- Mirror exact UI labels: If a Svelte component uses "Stimulus customization" in a dropdown, the docs MUST use the exact same string (case-sensitive).
- Update docs synchronously: When adding a new plot or changing a data ingestion format, update the corresponding `docs/basic/[plot].md` or `docs/upload-data/[format].md` file in the same PR/commit task.
- Use explicit frontmatter: Every new documentation page must include standard YAML frontmatter (`title`, `order`).
- Verify Config Tables: Keep markdown tables describing parameters (e.g. Bar Plot layout settings) absolutely synchronized with the default configs in `src/lib/plots/registry.ts`.
- Use standard markdown blockquotes for callouts: Format using `> **Bold Title**: Content` syntax.
- Maintain absolute architecture references: If documenting a CSV format, explicitly state the required headers, delimitation constraints, and parsing behavior (e.g., "Must contain exactly `Time`, `Participant`, `Stimulus`").

## DONTs

- Do NOT use fuzzy UI descriptions; avoid saying "click the stimulus button" if the UI says "Stimulus". Use bolded exact matches: **Stimulus**.
- Do NOT change the mathematical truths of the system in the docs without changing the code (e.g., if the docs say Segments are split by AOI|Participant|Stimulus, the ingest adapters must actually do that).
- Do NOT omit the `/docs/images/` pathing convention when adding new screenshots.
- Do NOT use custom `:::` blocks or headers (`#`) inside callouts.
- Do NOT use conversational fluff. Use clinical, senior-level technical writing.

## CONTEXT

### Documentation Architecture

The `docs/` folder serves as the ultimate source of truth for the user-facing application behavior. All markdown files here are automatically rendered and served directly within the application at the `/docs` route. It is structured into logical pillars:

1. `basic/`: Core visualizations (Bar Plot, Scarf Plot) and workspace manipulation.
2. `upload-data/`: Formalized schemas for parsing eye-tracking vectors from CSVs/hardware.
3. `export/`: Data outbound formats.
4. `advanced/`: Complex workflows and build instructions.

### The Documentation-Code Contract

A strict contract exists between the code and the docs:

- **Data Ingestion**: The constraints documented in `docs/upload-data/` (e.g. required headers like `timestamp`, `duration`) are strictly enforced by the adapters in `src/lib/data/ingest/stream/adapters`. If one changes, the other MUST change.
- **Plot Registry**: The parameter tables in `docs/basic/[plot].md` (e.g. "Scale range [ms]") directly map to the keys exposed by the `getDefaultConfig()` methods in the respective plot components.
- **Internal Routing**: Internal links must use absolute pathing from the root (e.g., `[Participant Groups](/docs/basic/groups/)`).
