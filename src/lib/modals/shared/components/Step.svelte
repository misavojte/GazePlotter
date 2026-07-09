<script lang="ts">
  import type { Snippet } from 'svelte'
  import { slide } from 'svelte/transition'
  import Check from 'lucide-svelte/icons/check'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { getStepListContext } from './stepContext'

  /**
   * One collapsible step of a guided modal flow. Collapsed, it shows the
   * numbered badge, the title, and a one-line summary of the current
   * selection; the badge turns into a check when `done`. Open, it renders the
   * optional explanation and the step's content at natural height — the step
   * never introduces its own scroll context. Open/close state lives in the
   * surrounding StepList (one step open at a time).
   */
  interface Props {
    n: number
    title: string
    /** One-line readout of the step's current state, shown while collapsed. */
    summary: string
    /** Completes the badge (check instead of the number). An incomplete
     *  step's summary renders in the alert color. */
    done: boolean
    /** Last step in the list — no connecting rail below its badge. */
    last?: boolean
    /** Optional one-sentence explanation shown when the step is open. */
    description?: string
    children: Snippet
  }

  let {
    n,
    title,
    summary,
    done,
    last = false,
    description = '',
    children,
  }: Props = $props()

  const steps = getStepListContext()
  const open = $derived(steps.isOpen(n))
</script>

<li class="step" class:last>
  <div class="step-rail">
    <span class="step-badge" class:done>
      {#if done}<Check size={14} strokeWidth={3} />{:else}{n}{/if}
    </span>
  </div>
  <div class="step-main" class:open>
    <button type="button" class="step-header" aria-expanded={open} onclick={() => steps.toggle(n)}>
      <span class="step-heading">
        <span class="step-title">{title}</span>
        <span class="step-summary" class:invalid={!done}>{summary}</span>
      </span>
      <span class="step-chevron" class:open>
        <ChevronDown size={16} />
      </span>
    </button>
    {#if open}
      <div class="step-body" transition:slide={{ duration: 200 }}>
        {#if description}
          <p class="step-description">{description}</p>
        {/if}
        {@render children()}
      </div>
    {/if}
  </div>
</li>

<style>
  .step {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.85rem;
  }

  .step-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 0.55rem;
  }

  /* Vertical guide connecting the badges of consecutive steps. */
  .step:not(.last) .step-rail::after {
    content: '';
    flex: 1;
    width: 1px;
    margin: 0.35rem 0;
    background-color: var(--c-border);
  }

  .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.65rem;
    height: 1.65rem;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--c-border);
    background-color: var(--c-lightgrey);
    color: var(--c-text);
    font-size: 0.8rem;
    font-weight: 600;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .step-badge.done {
    background-color: var(--c-brand);
    border-color: var(--c-brand);
    color: var(--c-white);
  }

  .step-main {
    min-width: 0;
    padding-bottom: 0.75rem;
  }

  .step.last .step-main {
    padding-bottom: 0;
  }

  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--c-border);
    border-radius: var(--rounded-md);
    background-color: var(--c-white);
    cursor: pointer;
    text-align: left;
    transition: border-color var(--transition-fast);
  }

  .step-header:hover {
    border-color: var(--c-midgrey);
  }

  .step-main.open .step-header {
    border-color: var(--c-midgrey);
  }

  .step-heading {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .step-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--c-text);
  }

  .step-summary {
    font-size: 0.8rem;
    color: var(--c-darkgrey);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .step-summary.invalid {
    color: var(--c-brand);
  }

  .step-chevron {
    display: inline-flex;
    color: var(--c-midgrey);
    transition: transform var(--transition-normal);
  }

  .step-chevron.open {
    transform: rotate(180deg);
  }

  .step-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 0.25rem 0.25rem 0.25rem;
  }

  .step-description {
    margin: 0;
    color: var(--c-darkgrey);
    font-size: 0.85rem;
    line-height: 1.4;
  }
</style>
