<script lang="ts">
  /**
   * The GazePlotter mark and name, linking home, followed by the running
   * version and its release month, linking to its changelog entry. One
   * markup for the app and the docs bar, so both read as the same product.
   */
  interface Props {
    /** The app page has no other heading, so its brand is the h1. */
    heading?: boolean
  }

  let { heading = false }: Props = $props()

  const version = __APP_VERSION__
  const changelogHref = `/docs/changelog#${version.replace(/\./g, '')}`
  const released = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(__BUILD_DATE__))
</script>

<div class="lockup">
  <a class="brand" href="/" aria-label="GazePlotter app">
    <img src="/logos/gazeplotter.svg" width="22" height="22" alt="" />
    <svelte:element this={heading ? 'h1' : 'span'} class="brand-name"
      >GazePlotter</svelte:element
    >
  </a>
  <a
    class="version"
    href={changelogHref}
    title="See what changed in version {version}"
    ><span class="version-text">v{version}, {released}</span></a
  >
</div>

<style>
  /* Mark, name and edition on one optical center line. */
  .lockup {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    height: 32px;
    /* Header 8px + 1px puts the 22px mark's center at x=20, the axis of the
       40px workspace rail's icons below it. */
    padding: 0 4px 0 1px;
    border-radius: var(--rounded-md);
    color: var(--c-black);
    text-decoration: none;
    transition: opacity var(--transition-fast) ease;
  }

  .brand img {
    display: block;
    flex: none;
  }

  .brand:hover {
    opacity: 0.75;
  }

  .brand:focus-visible,
  .version:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
  }

  /* Tight tracking and a semibold-plus weight: a wordmark, not a label. */
  .brand-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1;
    /* Trim the box to the cap height, so centering centers the letters, not
       the font's lopsided ascent and descent (Segoe UI sits ~1px low). */
    text-box: trim-both cap alphabetic;
  }

  /* The edition as quiet trailing text: present, never competing with the name. */
  .version {
    margin-left: 2px;
    border-radius: var(--rounded);
    color: var(--c-darkgrey);
    font-size: var(--text-2xs);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    text-decoration: none;
    transition: color var(--transition-fast) ease;
  }

  .version-text {
    text-box: trim-both cap alphabetic;
  }

  .version:hover {
    color: var(--c-black);
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
