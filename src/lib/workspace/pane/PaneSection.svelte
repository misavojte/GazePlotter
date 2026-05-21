<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import { PANE_ACCORDION_KEY, type PaneAccordion } from './accordion'

  interface Props {
    title?: string
    /**
     * Short readout shown to the right of the heading — usually the current
     * value of the picker inside. Lets researchers scan the pane's state
     * without expanding every section.
     */
    summary?: string
    /**
     * If true and no section is currently claimed in the accordion, this
     * section opens itself on mount. Use it to nominate the most-likely-
     * useful section to be expanded first (e.g., Stimulus). Only the first
     * `defaultOpen` section to mount claims openId; subsequent ones don't.
     */
    defaultOpen?: boolean
    children: Snippet
  }

  const { title, summary, defaultOpen = false, children }: Props = $props()

  // Per-instance id so the parent accordion (provided by `Pane` via
  // context) can identify which section is currently open. Untitled
  // sections are uncollapsible and don't participate.
  const id = crypto.randomUUID()
  const accordion = getContext<PaneAccordion | undefined>(PANE_ACCORDION_KEY)

  // Fallback for the no-context case (component used standalone): the
  // section manages its own open state, defaulting to expanded only when
  // there's no heading.
  let standaloneExpanded = $state(title === undefined)

  const isCollapsible = $derived(title !== undefined)
  const expanded = $derived(
    !isCollapsible
      ? true
      : accordion
        ? accordion.openId === id
        : standaloneExpanded,
  )

  function toggle() {
    if (!isCollapsible) return
    if (accordion) {
      accordion.openId = accordion.openId === id ? null : id
    } else {
      standaloneExpanded = !standaloneExpanded
    }
  }

  // `defaultOpen` claims openId on mount, unconditionally — every plot's
  // Stimulus section opens itself the moment it mounts, overriding any
  // stale openId left over from the previously-focused plot. onMount only
  // fires once per section instance, so if the user later collapses it
  // manually it stays collapsed for the rest of that plot's session.
  onMount(() => {
    if (defaultOpen && isCollapsible && accordion) {
      accordion.openId = id
    }
  })
</script>

<section class="pane-section">
  {#if title !== undefined}
    <button class="heading" aria-expanded={expanded} onclick={toggle}>
      <span class="icon" class:expanded>
        <ChevronDown size={14} strokeWidth={1.5} />
      </span>
      <span class="label">{title}</span>
      {#if summary}<span class="summary">{summary}</span>{/if}
    </button>
  {/if}

  {#if expanded}
    <div
      class="body"
      class:no-heading={title === undefined}
      transition:slide|local={{ duration: 180, easing: cubicOut, axis: 'y' }}
    >
      {@render children()}
    </div>
  {/if}
</section>

<style>
  .pane-section {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Top divider — same visual language as the rail: 1px tall, inset by
     the section's horizontal padding on both sides so it lines up with
     the heading/body content instead of running edge-to-edge. */
  .pane-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background-color: #e2e8f0;
  }

  /* Skip on the first section so it sits flush under the pane header. */
  .pane-section:first-of-type::before {
    content: none;
  }

  .heading {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px 8px;
    color: var(--c-darkgrey);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    background: none;
    border: none;
    width: 100%;
    cursor: pointer;
    transition: color 0.15s;
  }

  .heading:hover,
  .heading:focus-visible {
    color: var(--c-black);
    outline: none;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Negative margin to pull icon flush with typical padding without
       shrinking the click target of the heading itself */
    margin-left: -4px;
    line-height: 0;
    transition: transform 0.2s ease;
    transform: rotate(-90deg); /* points right when collapsed */
  }

  .icon.expanded {
    transform: rotate(0deg); /* points down when expanded */
  }

  .label {
    line-height: 1;
    margin-top: 1px;
  }

  /* Right-aligned readout of the section's current state. Muted, mixed-
     case, smaller weight so the section title still dominates. Truncates
     gracefully if the value is long (e.g. a verbose stimulus name). */
  .summary {
    margin-left: auto;
    color: var(--c-mediumgrey, #94a3b8);
    font-size: 11px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    line-height: 1;
    margin-top: 1px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }

  .body {
    padding: 4px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .body.no-heading {
    padding-top: 14px;
  }
</style>
