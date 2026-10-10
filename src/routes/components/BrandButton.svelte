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
  <span class="long">{label}</span>
  <span class="short">{shortLabel}</span>
</a>

<style>
  .brand-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 32px;
    /* Stable width so toggling between app and docs never shifts */
    min-width: 104px;
    padding: 0 14px;
    border-radius: var(--rounded-md);
    background-color: var(--c-brand);
    /* A lit top edge and a dark rim: a pressable tactile object, not a flat fill. */
    background-image: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--c-white) 12%, transparent),
      transparent
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--c-white) 22%, transparent),
      0 0 0 1px var(--c-brand-dark),
      0 1px 2px color-mix(in srgb, var(--c-brand-dark) 45%, transparent);
    color: var(--c-white);
    font-size: var(--text-md);
    font-weight: 600;
    letter-spacing: -0.005em;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
    transition:
      transform var(--transition-fast) ease,
      background-color var(--transition-fast) ease,
      background-image var(--transition-fast) ease,
      box-shadow var(--transition-fast) ease;
  }

  /* Grounded hover: stays stationary on the baseline, deepens cleanly */
  .brand-button:hover {
    background-color: var(--c-brand-dark);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--c-white) 28%, transparent),
      0 0 0 1px var(--c-brand-dark),
      0 1px 3px color-mix(in srgb, var(--c-brand-dark) 55%, transparent);
  }

  .brand-button:focus-visible {
    outline: 2px solid var(--c-info);
    outline-offset: 2px;
  }

  /* Active / Click: subtle 1px tactile depression with recessed inset shadow */
  .brand-button:active {
    transform: translateY(1px);
    background-color: var(--c-brand-dark);
    background-image: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--c-black) 10%, transparent)
    );
    box-shadow:
      inset 0 1px 2px color-mix(in srgb, var(--c-black) 35%, transparent),
      0 0 0 1px var(--c-brand-dark);
  }

  .short {
    display: none;
  }

  /* Narrow screens: compact text that never crowds the header */
  @media (max-width: 640px) {
    .brand-button {
      min-width: auto;
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
