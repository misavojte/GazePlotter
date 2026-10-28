<script lang="ts">
  import { fade } from 'svelte/transition'
  import { prefersReducedMotion } from 'svelte/motion'
  import { cubicIn, cubicOut } from 'svelte/easing'
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    children: Snippet
  }

  let { title, children }: Props = $props()
</script>

<!-- When one card replaces another, the old one is nearly gone before the
     new one shows, so two states never read at once and nothing waits. -->
<div
  class="workspace-indicator"
  in:fade={{ duration: prefersReducedMotion.current ? 0 : 300, easing: cubicIn }}
  out:fade={{ duration: prefersReducedMotion.current ? 0 : 150, easing: cubicOut }}
>
  <div class="indicator-card">
    <!-- Polite: a new phase ("Reading data") is announced, not just shown. -->
    <div class="indicator-header" aria-live="polite">
      <h3 class="indicator-title">{title}</h3>
    </div>
    <div class="indicator-body">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .workspace-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .indicator-card {
    max-width: 500px;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--c-lightgrey);
    border-radius: var(--rounded-lg);
    border: 1px solid var(--c-border);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Header and body as a plot's frame draws them (GridItem). */
  .indicator-header {
    display: flex;
    align-items: center;
    padding: 10px 25px;
    min-height: 47px;
    box-sizing: border-box;
    background: var(--c-lightgrey);
  }

  .indicator-title {
    margin: 0;
    font-size: var(--text-xl);
    letter-spacing: -0.01em;
    font-weight: 600;
    color: var(--c-black);
    line-height: var(--leading-tight);
    text-wrap: balance;
  }

  .indicator-body {
    padding: 25px;
    /* Concentric with the card: its radius minus the 1px border. */
    border-radius: calc(var(--rounded-lg) - 1px);
    background-color: var(--c-white);
  }

  @media (max-width: 600px) {
    .indicator-card {
      margin: 0 16px;
    }
  }
</style>
