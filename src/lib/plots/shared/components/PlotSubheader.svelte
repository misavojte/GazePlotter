<script lang="ts">
  interface Props {
    title: string
    /** Subheader line: small, uppercase, letter-spaced. Empty/undefined hides it. */
    subtitle?: string | undefined
    /** When true, the selected-plot outline highlight is shown. */
    active?: boolean
    onSelect: () => void
  }

  const { title, subtitle, active = false, onSelect }: Props = $props()
</script>

<button
  type="button"
  class="plot-subheader"
  class:active
  onclick={onSelect}
>
  <span class="title">{title}</span>
  {#if subtitle}
    <span class="subtitle">{subtitle}</span>
  {/if}
</button>

<style>
  .plot-subheader {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: none;
    border: none;
    padding: 4px 8px;
    cursor: pointer;
    text-align: left;
    min-width: 0;
    border-radius: 4px;
    transition: background 0.12s ease, box-shadow 0.12s ease;
  }
  .plot-subheader:hover {
    background: var(--c-lightergrey, #f3f4f6);
  }
  .plot-subheader.active {
    background: var(--c-lightgrey, #e5e7eb);
    box-shadow: inset 0 0 0 1px var(--c-brand, #4a90e2);
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    color: var(--c-text);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Matches GroupSelect compact label styling: 8px uppercase letter-spaced. */
  .subtitle {
    font-size: 8px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.0333em;
    color: var(--c-darkgrey);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
