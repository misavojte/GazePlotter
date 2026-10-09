<script lang="ts" module>
  /** Overridable palette keys; values live once, in this component's CSS.
   *  Border and shadows derive from `black`, so they follow it. */
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
  // The one pinned :global(:root) in lib: tokens are global by definition,
  // and as compiled CSS they style any host with zero setup.
  interface Props {
    /** Palette overrides; applied reactively, so hosts can theme live. */
    colors?: GazePlotterColors
  }

  const { colors }: Props = $props()

  // CSSOM, never markup: a hostile value cannot escape setProperty.
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

    /* System UI font; Segoe UI Variable is Windows 11's sharper small-size
       cut. KEEP IN SYNC with SYSTEM_SANS_SERIF_STACK (canvas text). */
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text',
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

    /* Windows 11 optical cuts: Small is drawn for 12px and under, Display
       for large or brand text. Elsewhere both resolve to the system font. */
    --font-small: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Small',
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --font-display: -apple-system, BlinkMacSystemFont,
      'Segoe UI Variable Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
      sans-serif;

    /* Type scale: every UI size is one of these steps, in px so a host
       page's root font size never rescales the app. */
    --text-3xs: 8px; /* plot header captions, version badge */
    --text-2xs: 10px; /* badges, micro counts */
    --text-xs: 11px; /* captions, uppercase section labels */
    --text-sm: 12px; /* secondary text, hints */
    --text-md: 13px; /* default UI text, controls */
    --text-lg: 14px; /* modal body, prominent text */
    --text-xl: 15px; /* plot, pane and section titles */

    /* Line heights: tight for one-line labels and titles, normal for text
       that wraps, relaxed for help paragraphs. */
    --leading-tight: 1.2;
    --leading-normal: 1.4;
    --leading-relaxed: 1.5;

    --rounded: 4px;
    --rounded-md: 8px;
    --rounded-lg: 20px;
    --menu-border-color: var(--c-border);
    --menu-border-width: 1px;

    --transition-fast: 120ms;
    --transition-normal: 200ms;
    --transition-slow: 300ms;

    /* Spacing Tokens */
    --spacing-xxs: 4px;
    --spacing-xs: 8px;
    --spacing-sm: 12px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;

    /* Elevation Tokens (ink-based shadows) */
    --shadow-sm: 0 1px 2px 0 color-mix(in srgb, var(--c-black) 5%, transparent);
    --shadow: 0 1px 3px 0 color-mix(in srgb, var(--c-black) 10%, transparent), 0 1px 2px -1px color-mix(in srgb, var(--c-black) 10%, transparent);
    --shadow-md: 0 4px 6px -1px color-mix(in srgb, var(--c-black) 8%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--c-black) 4%, transparent);
    --shadow-lg: 0 10px 15px -3px color-mix(in srgb, var(--c-black) 8%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--c-black) 4%, transparent);
    --shadow-xl: 0 20px 25px -5px color-mix(in srgb, var(--c-black) 10%, transparent), 0 8px 10px -6px color-mix(in srgb, var(--c-black) 5%, transparent);
  }
</style>
