<script lang="ts">
  /**
   * The red button that crosses between the two halves of the site: from
   * the app to the guide, and from the guide back to the app.
   */
  interface Props {
    href: string
    label: string
    /** Label on narrow screens. */
    shortLabel: string
  }

  let { href, label, shortLabel }: Props = $props()
</script>

<a class="brand-button" {href}>
  <span class="long">{label}</span><span class="short">{shortLabel}</span>
</a>

<style>
  .brand-button {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 32px;
    padding: 0 14px;
    border-radius: var(--rounded-md);
    background-color: var(--c-brand);
    color: var(--c-white);
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color var(--transition-fast) ease;
  }

  .brand-button:hover,
  .brand-button:focus-visible {
    background-color: var(--c-brand-dark);
  }

  .short {
    display: none;
  }

  @media (max-width: 640px) {
    .brand-button {
      padding: 0 10px;
    }

    .long {
      display: none;
    }

    .short {
      display: inline;
    }
  }
</style>
