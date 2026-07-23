<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    instructions?: string
    children?: Snippet
  }

  let { title, instructions, children }: Props = $props()
</script>

<div class="question-header">
  <h2>{title}</h2>
  {#if instructions}
    <p class="instructions">
      {instructions}
      {#if children}
        <br />
        {@render children()}
      {/if}
    </p>
  {/if}
</div>

<style>
  .question-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--c-black);
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .instructions {
    color: var(--c-darkgrey);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
  }

  @media (max-width: 640px) {
    h2 {
      font-size: 1.1rem;
    }
    .instructions {
      font-size: 0.85rem;
    }
  }
</style>
