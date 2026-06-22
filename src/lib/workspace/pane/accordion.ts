/**
 * Shared section open/collapse state for a single Pane. `Pane.svelte` creates
 * one of these as a `$state` proxy and provides it to descendants via context;
 * each `PaneSection` reads/writes its own entry in `openStates` (keyed by a
 * stable id derived from the section title). Sections expand and collapse
 * independently — multiple can be open at once — and the shared map survives
 * plot switches so a section the user opened stays open.
 */

export interface PaneAccordion {
  openStates: Record<string, boolean>
}

export const PANE_ACCORDION_KEY = Symbol('paneAccordion')
