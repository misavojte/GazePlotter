/**
 * Shared accordion state for a single Pane. `Pane.svelte` creates one of
 * these as a `$state` proxy and provides it to descendants via context;
 * each `PaneSection` consumes it to drive its expand/collapse so that
 * opening one section auto-closes the previously open one.
 */

export interface PaneAccordion {
  openId: string | null
}

export const PANE_ACCORDION_KEY = Symbol('paneAccordion')
