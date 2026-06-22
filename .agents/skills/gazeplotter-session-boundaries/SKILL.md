---
name: gazeplotter-session-boundaries
description: Session ownership, dependency access, and failure-boundary rules for GazePlotter. MUST use when modifying session creation, session-owned services, error handling, toast/reporting, worker-main-thread handoffs, or modal/plot/workspace boundaries.
---

# GazePlotter Session Boundaries

## Overview

Use this skill when changing how GazePlotter creates shared state, accesses session services, or reports failures. Goals: keep session ownership explicit, keep deep code dependency-free, and route actionable failures through the correct boundary.

## Architecture Anchors

- Session composition root: `src/lib/session/session.ts`
- Runtime entrypoint that creates and installs the session: `src/lib/GazePlotter.svelte`
- Session context accessor for components: `$lib/session`

Core subsystems created in `createGazePlotterSession()`: `engine`, `errorService`, `exportService`, `ingest`, `grid`, `workspace`, `modalState`, `toastState`. If a change affects ownership between these, check `src/lib/session/session.ts` first.

## Session Access Rules

- Svelte components inside the GazePlotter tree read services/state via `$lib/session`.
- Plain TypeScript modules do not read Svelte context; they receive dependencies explicitly as parameters or constructor inputs. (Deliberate exception: `src/lib/plots/shared/components/sections/common.ts` reads context because it runs during component init.)
- Do not introduce ambient globals, singleton bridges, or current-session fallbacks; `getGazePlotterSession()` throws rather than falling back.
- Workers cannot use session services. They post terminal messages back to the main thread.

## Failure Boundary Rules

- Deep helpers, parsers, updaters, and worker internals throw or post failure upward; they do not report.
- Only session-owned services and UI boundary hosts call `errorService.report(...)`. Put render boundaries at host surfaces, not inside every deep helper. Prefer one reporting point per terminal failure path.
- Keep `ErrorService` a synchronous reporting sink, not a retry/cancellation/progress orchestrator.

Boundary hosts in this repo:

- Workspace plot host: `src/lib/workspace/grid/Grid.svelte`
- Shared modal host: `src/lib/modals/shared/components/Modal.svelte`
- Export preview host: `src/lib/modals/export/download-plot/CanvasPreview.svelte`
- Session bootstrap/load boundary: `src/lib/GazePlotter.svelte`

Worker handoff example: the ingest worker posts `{ type: 'fail', data: error }` (`src/lib/data/ingest/worker.ts`); the main-thread ingest service handles `case 'fail'` -> `handleError` -> `errorService.report` (`src/lib/data/ingest/service.svelte.ts`).

## Severity And Reporting

- `recoverable`: the UI can continue but the user should be told something failed.
- `fatal-load`: dataset/session loading is unusable; the workspace should reflect that state.
- `errorService.report(...)` ALWAYS toasts (via `toastState.addError`) and console-groups a debug trace. So the choice to call `report()` (vs not) IS the toast choice; there is no separate severity-gated toast switch. For non-actionable developer traces, do not call `report()`.
- Do not silently replace broken state with plausible fallback data unless the UI acknowledges the partial failure.

## Anti-Patterns

- Raw `console.warn`/`console.error` for actionable failures the user should be told about.
- Swallowed exceptions that leave the UI loading or stale.
- Calling session accessors from plain TypeScript modules or workers.
- Duplicating toast + console handling locally instead of reporting once through `errorService`.
- Expanding the errors module into retry, cancellation, progress, or runtime orchestration.

## Change Checklist

- Where is the owning boundary for this failure?
- Should the user be acknowledged, or is this console-only diagnostic noise?
- Is the failure `recoverable` or `fatal-load`?
- Should this code throw upward or report directly?
- Is a worker/main-thread handoff involved?
- Does this change preserve explicit dependency injection for non-component code?
