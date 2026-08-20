<script lang="ts" module>
  /** Palette keys overridable via the `colors` embedding option; values live
   *  once, in this component's CSS. `--c-border` and the shadows derive from
   *  `black`, so they follow an override automatically. */
  export type GazePlotterColors = Partial<
    Record<
      | 'brand'
      | 'brandDark'
      | 'white'
      | 'darkwhite'
      | 'lightgrey'
      | 'grey'
      | 'midgrey'
      | 'darkgrey'
      | 'text'
      | 'black'
      | 'error'
      | 'success'
      | 'warning'
      | 'info',
      string
    >
  >

  /** Custom property name for a palette key (`brandDark` -> `--c-brand-dark`). */
  export const cssColorVar = (key: keyof GazePlotterColors): string =>
    `--c-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`
</script>

<script lang="ts">
  // The one sanctioned root-level :global in src/lib (pinned by
  // tests/libPlatformBoundary.test.ts): design tokens are global by
  // definition. As compiled CSS they ship with the component, so any host is
  // styled with zero setup, at first paint, with no inline-style CSP
  // allowance.
  interface Props {
    /** Palette overrides; applied reactively, so hosts can theme live. */
    colors?: GazePlotterColors
  }

  const { colors }: Props = $props()

  // Overrides go through CSSOM, never string-interpolated markup: a hostile
  // value cannot escape setProperty, so no sanitizer is needed. On shared
  // keys the last mounted instance wins; cleanup restores the defaults.
  $effect(() => {
    const style = document.documentElement.style
    const entries = Object.entries(colors ?? {}) as [
      keyof GazePlotterColors,
      string,
    ][]
    for (const [key, value] of entries) {
      style.setProperty(cssColorVar(key), value)
    }
    return () => {
      for (const [key] of entries) style.removeProperty(cssColorVar(key))
    }
  })
</script>

<style>
  :global(:root) {
    --c-brand: #cd1404;
    --c-brand-dark: #a20d03;
    --c-white: #ffffff;
    --c-darkwhite: #f8fafc;
    --c-lightgrey: #f1f5f9;
    --c-grey: #e2e8f0;
    --c-midgrey: #cbd5e1;
    --c-darkgrey: #64748b; /* Slate 500 */
    --c-text: #1e293b; /* Slate 800 */
    --c-black: #0f172a; /* Slate 900 */
    /* Border: translucent ink for a delicate, premium feel */
    --c-border: color-mix(in srgb, var(--c-black) 10%, transparent);

    --c-error: #ff4d4f;
    --c-success: #22c55e;
    --c-warning: #faad14;
    --c-info: #1890ff;

    --rounded: 4px;
    --rounded-md: 8px;
    --rounded-lg: 20px;
    --menu-border-color: var(--c-border);
    --menu-border-width: 1px;

    --transition-fast: 120ms;
    --transition-normal: 200ms;
    --transition-slow: 300ms;

    /* Spacing Tokens */
    --spacing-xxs: 0.25rem; /* 4px */
    --spacing-xs: 0.5rem; /* 8px */
    --spacing-sm: 0.75rem; /* 12px */
    --spacing-md: 1rem; /* 16px */
    --spacing-lg: 1.5rem; /* 24px */
    --spacing-xl: 2rem; /* 32px */

    /* Elevation Tokens (ink-based shadows) */
    --shadow-sm: 0 1px 2px 0 color-mix(in srgb, var(--c-black) 5%, transparent);
    --shadow: 0 1px 3px 0 color-mix(in srgb, var(--c-black) 10%, transparent), 0 1px 2px -1px color-mix(in srgb, var(--c-black) 10%, transparent);
    --shadow-md: 0 4px 6px -1px color-mix(in srgb, var(--c-black) 8%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--c-black) 4%, transparent);
    --shadow-lg: 0 10px 15px -3px color-mix(in srgb, var(--c-black) 8%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--c-black) 4%, transparent);
    --shadow-xl: 0 20px 25px -5px color-mix(in srgb, var(--c-black) 10%, transparent), 0 8px 10px -6px color-mix(in srgb, var(--c-black) 5%, transparent);
  }
</style>
