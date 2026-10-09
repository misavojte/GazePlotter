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
    /* A lit top edge and a dark rim: a pressable object, not a flat fill. */
    background-image: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--c-white) 10%, transparent),
      transparent
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--c-white) 22%, transparent),
      0 0 0 1px var(--c-brand-dark),
      0 1px 2px color-mix(in srgb, var(--c-brand-dark) 45%, transparent);
    color: var(--c-white);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color var(--transition-fast) ease,
      box-shadow var(--transition-fast) ease;
  }

  .brand-button:hover {
    background-color: var(--c-brand-dark);
  }

  .brand-button:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
  }

  .brand-button:active {
    background-image: none;
    box-shadow:
      inset 0 1px 2px color-mix(in srgb, var(--c-black) 25%, transparent),
      0 0 0 1px var(--c-brand-dark);
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
