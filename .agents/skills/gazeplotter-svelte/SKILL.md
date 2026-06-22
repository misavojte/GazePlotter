---
name: gazeplotter-svelte
description: Svelte 5 conventions, shared components, design tokens, and the verification bar for GazePlotter. MUST use when writing or modifying Svelte code in this project.
---

# Svelte 5 & GazePlotter

## DOs

- Use Svelte 5 runes natively ($state, $derived, $effect, $props()).
- Use direct event attributes (onclick={...}) and callback props.
- Use {#snippet} and @render instead of slots.
- Use vanilla CSS in `<style>`. NO Tailwind (there is no Tailwind config or dependency).
- Use lucide-svelte for icons.
- Use the shared components from `$lib/shared/components` instead of native controls: `ButtonMajor`, `ButtonMinor`, `InputText`, `InputNumber`, `InputFile`, `InputCheck`, `InputColor`, `Select`, `GroupSelect`, `Radio`, `ButtonPreset`, `Card`, `Empty`. There is no `General*` prefix.
- Per-session state lives in class instances with runes in `*.svelte.ts` files (e.g. `gridState.svelte.ts`, `modalState.svelte.ts`, `toastState.svelte.ts`), created per session. The suffix is `*.svelte.ts`, not `.state.svelte.ts`.

## DONTs

- No Svelte 4 reactivity (`export let`, `$:`), no `on:click`, no `createEventDispatcher`, no `writable()` for app state.
- Do not `bind:value` a sparse/optional record member into `Radio`/`Select`; a missing key crashes on the fallback path. Pass `value={...}` plus `onchange` one-way instead.
- Do not introduce module-level mutable singleton state for application data; instantiate state per session and inject it. (A few plot axis-sync singletons exist as deliberate exceptions.)
- Do not put large raw tracker arrays into `$state` (proxy cost); keep binary buffers out of runes.
- Prefer scoped CSS over `:global` (a handful of justified `:global` uses exist; it is a preference, not a hard ban).
- Do not use fallbacks in CSS variable references; all tokens live in `src/app.css` and are referenced without fallbacks to prevent drift. The brand token is `--c-brand` (#cd1404); there is no `--c-primary`.
- Do not hardcode transition durations. Use `--transition-fast` (120ms) for hover/quick feedback, `--transition-normal` (200ms) for inputs/buttons/dropdowns, `--transition-slow` (300ms) for sheets/sidebars/theme sweeps.

## Session access

Components read services/state from Svelte context via `$lib/session`; plain TS modules receive dependencies as parameters; no ambient globals or singleton bridges. Full ownership and failure-routing rules are in the `gazeplotter-session-boundaries` skill.

## Verify

In-code only: `npm run check` (svelte-check) and `npm test` (vitest). Do not start a dev server or use Playwright to verify a change.

## Context

- `src/lib`: the core library (data engine, plots, shared components, session) and agnostic visual components.
- `src/routes`: the deployed SvelteKit app (the `etvis` app, `/docs`, survey). It is the real application, not a showcase/testing site.
- GazePlotter handles large coordinate sets; performance is paramount (see the gazeplotter-plot skill for hot-path rules).
