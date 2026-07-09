import { getContext, setContext } from 'svelte'

/**
 * Accordion state shared between a StepList and its Steps: exactly one step
 * open at a time (0 = all collapsed). Owned by StepList so modals don't carry
 * openStep/toggle plumbing.
 */
export interface StepListContext {
  isOpen: (n: number) => boolean
  toggle: (n: number) => void
}

const KEY = Symbol('step-list')

export function setStepListContext(ctx: StepListContext): void {
  setContext(KEY, ctx)
}

export function getStepListContext(): StepListContext {
  const ctx = getContext<StepListContext | undefined>(KEY)
  if (!ctx) throw new Error('Step must be rendered inside a StepList')
  return ctx
}
