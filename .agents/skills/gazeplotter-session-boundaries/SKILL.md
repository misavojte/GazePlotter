---
name: gazeplotter-session-boundaries
description: Session ownership, dependency access, and failure-boundary rules for GazePlotter. MUST use when modifying session creation, session-owned services, error handling, toast/reporting, worker-main-thread handoffs, or modal/plot/workspace boundaries.
---

# GazePlotter Session Boundaries

## Overview

Use this skill when changing how GazePlotter creates shared state, accesses session services, or reports failures to the user. The goal is to keep session ownership explicit, keep deep code dependency-free, and route actionable failures through the correct boundary.

## Architecture Anchors

- Session composition root: `src/lib/session/session.ts`
- Runtime entrypoint that creates and installs the session: `src/lib/GazePlotter.svelte`
- Session context accessor for components: `$lib/session`

Current core subsystems created in `createGazePlotterSession()`:

- `engine`
- `errorService`
- `exportService`
- `ingest`
- `grid`
- `workspace`
- `modalState`
- `toastState`

If a change affects ownership between these subsystems, check `src/lib/session/session.ts` first.

## Session Access Rules

- Svelte components inside the GazePlotter tree use `$lib/session`.
- Plain TypeScript modules do not read Svelte context directly.
- Non-component code receives dependencies explicitly in parameters or constructor inputs.
- Do not introduce ambient globals, singleton bridges, or current-session fallbacks.
- Workers cannot use session services directly. They post terminal messages back to the main thread.

## Failure Boundary Rules

- Deep helpers, parsers, updaters, and worker internals throw or post failure upward.
- Session-owned services and UI boundaries call `errorService.report(...)`.
- Put render boundaries at host surfaces, not inside every deep helper.

Primary boundary hosts in this repo:

- Workspace plot host: `src/lib/workspace/grid/Grid.svelte`
- Shared modal host: `src/lib/modals/shared/components/Modal.svelte`
- Export preview host: `src/lib/modals/shared/components/CanvasPreview.svelte`
- Session bootstrap/load boundary: `src/lib/GazePlotter.svelte`

## Severity And User Acknowledgement

- Use `recoverable` when the UI can continue and the user should be told something failed.
- Use `fatal-load` when dataset/session loading is unusable and the workspace should reflect that state.
- Toast actionable user-facing failures.
- Keep console-only diagnostics for non-actionable safety brakes or developer-only traces.
- Do not silently replace broken state with plausible fallback data unless the UI clearly acknowledges the partial failure.

## Core Patterns

- Components read session services from `$lib/session`.
- Plain modules receive service dependencies explicitly.
- Worker failures are posted back and reported on the main thread.
- Prefer one reporting point per terminal failure path.
- Keep `ErrorService` as a reporting sink, not an async orchestrator.

## Anti-Patterns

- Raw `console.warn` or `console.error` for actionable failures that should be acknowledged by the user.
- Swallowed exceptions that leave the UI loading or stale.
- Calling session accessors from plain TypeScript modules or workers.
- Duplicating toast and console handling locally when the boundary can report once through `errorService`.
- Expanding the errors module into retry, cancellation, progress, or runtime orchestration.

## Change Checklist

- Where is the owning boundary for this failure?
- Should the user be acknowledged, or is this console-only diagnostic noise?
- Is the failure `recoverable` or `fatal-load`?
- Should this code throw upward or report directly?
- Is a worker/main-thread handoff involved?
- Does this change preserve explicit dependency injection for non-component code?
- Should a focused regression test be added for the boundary path?
