<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * Common frame of every export modal: the stable design width (the modal
   * shell clamps it on smaller viewports, so the dialog never resizes as
   * steps open and close) and an optional one-line purpose intro.
   */
  interface Props {
    intro?: string
    children: Snippet
  }

  let { intro = '', children }: Props = $props()
</script>

<div class="container">
  {#if intro}
    <p class="purpose-description">{intro}</p>
  {/if}
  {@render children()}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    width: 840px;
    max-width: 100%;
  }

  .purpose-description {
    margin: 0 0 16px 0;
    color: var(--c-text);
    font-size: var(--text-xl);
    letter-spacing: -0.01em;
    line-height: var(--leading-normal);
    text-wrap: pretty;
  }
</style>
