---
description: Svelte 5 coding guidelines for GazePlotter. MUST use when writing or modifying Svelte code in this project.
---

# Svelte 5 & GazePlotter

## DOs

- Use Svelte 5 Runes natively ($state, $derived, $effect, $props()).
- Use direct event attributes like onclick={...}.
- Pass callback props for component events instead of createEventDispatcher.
- Use {#snippet} and @render instead of slots.
- Use vanilla CSS (<style>) only. NO Tailwind.
- Use GazePlotter shared components:
  - GeneralButtonMajor / GeneralButtonMinor ($lib/shared/components)
  - GeneralInputText / GeneralInputNumber ($lib/shared/components)
  - GeneralSelect
- Use lucide-svelte for icons.
- Manage global state via class instances with runes in .state.svelte.ts files.
- Use the session boundary consistently:
  - Components read state/services from Svelte context via `$lib/session`.
  - Plain TypeScript modules receive dependencies explicitly in function parameters.
  - Do not introduce ambient globals, current-session fallbacks, or singleton bridges.

## DONTs

- No Svelte 4 reactivity (let with $:, or export let).
- No on:click directives.
- No Tailwind classes.
- Do not blindly nest large raw tracker arrays into $state (performance cost).
- Do not use native HTML <button> or <input> if General\* components exist.
- No application state in src/lib.
- No Svelte 4 writable() for global state.
- No :global CSS (prefer scoped).

## CONTEXT

- src/lib: Core library and agnostic visual components.
- src/routes: Showcase and integration testing site.
- Data Load: GazePlotter handles large coordinate sets. Performance is paramount.
