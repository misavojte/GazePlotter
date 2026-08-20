/** Palette hosts may override via the `colors` embedding option (partial;
 *  unset keys keep the built-in palette). `--c-border` and the shadows derive
 *  from `black`, so they follow an override automatically. */
export type GazePlotterColors = Partial<typeof DEFAULT_COLORS>

export const DEFAULT_COLORS = {
  brand: '#cd1404',
  brandDark: '#a20d03',
  white: '#ffffff',
  darkwhite: '#f8fafc',
  lightgrey: '#f1f5f9',
  grey: '#e2e8f0',
  midgrey: '#cbd5e1',
  darkgrey: '#64748b', // Slate 500
  text: '#1e293b', // Slate 800
  black: '#0f172a', // Slate 900
  error: '#ff4d4f',
  success: '#22c55e',
  warning: '#faad14',
  info: '#1890ff',
}

const kebab = (key: string) => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)

/** Custom property name for a palette key (`brandDark` -> `--c-brand-dark`). */
export const cssColorVar = (key: keyof typeof DEFAULT_COLORS): string =>
  `--c-${kebab(key)}`

const STATIC_TOKENS = `  /* Border: translucent ink for a delicate, premium feel */
  --c-border: color-mix(in srgb, var(--c-black) 10%, transparent);

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
  --spacing-xs: 0.5rem;   /* 8px */
  --spacing-sm: 0.75rem;  /* 12px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */

  /* Elevation Tokens (ink-based shadows) */
  --shadow-sm: 0 1px 2px 0 color-mix(in srgb, var(--c-black) 5%, transparent);
  --shadow: 0 1px 3px 0 color-mix(in srgb, var(--c-black) 10%, transparent), 0 1px 2px -1px color-mix(in srgb, var(--c-black) 10%, transparent);
  --shadow-md: 0 4px 6px -1px color-mix(in srgb, var(--c-black) 8%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--c-black) 4%, transparent);
  --shadow-lg: 0 10px 15px -3px color-mix(in srgb, var(--c-black) 8%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--c-black) 4%, transparent);
  --shadow-xl: 0 20px 25px -5px color-mix(in srgb, var(--c-black) 10%, transparent), 0 8px 10px -6px color-mix(in srgb, var(--c-black) 5%, transparent);
`

/** The `:root` token block rendered into <head>. A compile-time constant:
 *  nothing host-provided is ever interpolated into markup; color overrides
 *  go through CSSOM instead (DesignTokens.svelte). */
export const TOKEN_CSS = `:root {\n${Object.entries(DEFAULT_COLORS)
  .map(([key, value]) => `  ${cssColorVar(key as keyof typeof DEFAULT_COLORS)}: ${value};`)
  .join('\n')}\n${STATIC_TOKENS}}`
