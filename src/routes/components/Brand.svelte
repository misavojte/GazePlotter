<script lang="ts">
  /**
   * The GazePlotter mark and name, linking home, followed by the running
   * version, linking to its changelog entry. One markup for the app and the
   * docs bar, so both read as the same product.
   */
  interface Props {
    /** The app page has no other heading, so its brand is the h1. */
    heading?: boolean
  }

  let { heading = false }: Props = $props()

  const version = __APP_VERSION__
  const changelogHref = `/docs/changelog#${version.replace(/\./g, '')}`
</script>

<div class="lockup">
  <a class="brand" href="/" aria-label="GazePlotter app">
    <img src="/logos/gazeplotter.svg" width="20" height="20" alt="" />
    <svelte:element this={heading ? 'h1' : 'span'} class="brand-name"
      >GazePlotter</svelte:element
    >
  </a>
  <a
    class="version"
    href={changelogHref}
    title="See what changed in version {version}"
    aria-label="Version {version}, see what changed">{version}</a
  >
</div>

<style>
  /* Name and version share one baseline, the way a title and its edition
     are set in print. Each line box is the full bar height, so the
     baseline also lands at the optical center. */
  .lockup {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .brand {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    height: 32px;
    padding: 0 4px;
    color: var(--c-black);
    text-decoration: none;
  }

  .brand img {
    align-self: center;
  }

  .brand:hover,
  .brand:focus-visible {
    opacity: 0.8;
  }

  .brand-name {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 32px;
  }

  .version {
    padding: 0 2px;
    border-radius: var(--rounded);
    color: color-mix(in srgb, var(--c-darkgrey) 80%, var(--c-midgrey));
    font-size: 11.5px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
    line-height: 32px;
    text-decoration: none;
    transition: color var(--transition-fast) ease;
  }

  .version:hover,
  .version:focus-visible {
    color: var(--c-text);
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

    .version {
      display: none;
    }
  }
</style>
