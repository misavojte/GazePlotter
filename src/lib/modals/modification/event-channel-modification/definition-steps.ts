import CreateIntervals from './create-intervals/Modal.svelte'
import { defineModal } from '$lib/modals/defineModal'

/**
 * Pushed step of the Event Library modal (same pattern as the metric
 * library's steps): derive interval channels from start/end event pairs.
 * Resolves `true` when intervals were created, `null` on Back — hosts use
 * the result to decide whether to re-pull engine state.
 */
export const createEventIntervalsModal = defineModal<
  typeof CreateIntervals,
  boolean
>({
  component: CreateIntervals,
  title: 'Create intervals',
})
