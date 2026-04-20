<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    children: Snippet
  }

  const { title, children }: Props = $props()
</script>

<section class="pane-section">
  <div class="heading">
    <span class="label">{title}</span>
  </div>

  <div class="body">
    {@render children()}
  </div>
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
    gap: 4px;
    padding: 10px 16px 8px;
    color: var(--c-darkgrey);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
  }

  .label {
    line-height: 1;
  }

  .body {
    padding: 4px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
