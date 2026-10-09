<script lang="ts">
  /**
   * The GazePlotter mark and name, linking home. One markup for the app's
   * floating island and the docs bar, so both read as the same product.
   */
  interface Props {
    /** The app page has no other heading, so its brand is the h1. */
    heading?: boolean
  }

  let { heading = false }: Props = $props()
</script>

<a class="brand" href="/" aria-label="GazePlotter app">
  <img src="/logos/gazeplotter.svg" width="20" height="20" alt="" />
  <svelte:element this={heading ? 'h1' : 'span'} class="brand-name"
    >GazePlotter</svelte:element
  >
</a>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 4px;
    color: var(--c-black);
    text-decoration: none;
  }

  .brand:hover,
  .brand:focus-visible {
    opacity: 0.8;
  }

  .brand-name {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
  }

  /* Narrow screens keep the mark; the name stays for screen readers. */
  @media (max-width: 640px) {
    .brand-name {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
</style>
