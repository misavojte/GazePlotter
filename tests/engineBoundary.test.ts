import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

// The engine behind the CLI is src/lib/data, src/lib/metrics,
// src/lib/version.ts, and the palette constants (dataset default colours).
// It imports nothing else of ours, no component, and no DOM API, so it runs in Node.

const ENGINE = ['/src/lib/data/', '/src/lib/metrics/', '/src/lib/version/', '/src/lib/color/palettes/']
const PACKAGES = ['jszip']

const sources = import.meta.glob(
  ['/src/lib/data/**/*.ts', '/src/lib/metrics/**/*.ts', '/src/lib/version.ts', '/src/lib/color/palettes.ts'],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const SPECIFIER =
  /(?:^\s*(?:import|export)\b[^;'"]*?\bfrom\s*|^\s*import\s+|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm

const DOM =
  /\bdocument\.|\bnavigator\.|\blocalStorage\b|\bsessionStorage\b|URL\.createObjectURL|new Worker\(|new Image\(|requestAnimationFrame|OffscreenCanvas|createImageBitmap|\bwindow\.(confirm|alert|location|open|addEventListener|removeEventListener|innerWidth|innerHeight|devicePixelRatio|getComputedStyle|matchMedia|showSaveFilePicker)/

describe('engine boundary', () => {
  it('globs the engine', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
    expect('/src/lib/metrics/query.ts' in sources).toBe(true)
  })

  it('imports only the engine and its packages', () => {
    const violations: string[] = []
    for (const [file, content] of Object.entries(sources)) {
      for (const [, raw] of content.matchAll(SPECIFIER)) {
        const spec = raw.split('?')[0]
        const target = spec.startsWith('$lib')
          ? '/src/lib' + spec.slice(4)
          : spec.startsWith('.')
            ? posix.join(posix.dirname(file), spec)
            : null
        const ok = target
          ? ENGINE.some(prefix => `${target}/`.startsWith(prefix))
          : PACKAGES.includes(spec)
        if (!ok) violations.push(`${file}: ${raw}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('holds no component', () => {
    const components = Object.keys(
      import.meta.glob(['/src/lib/data/**/*.svelte', '/src/lib/metrics/**/*.svelte'])
    )
    expect(components).toEqual([])
  })

  it('touches no DOM API', () => {
    const offenders = Object.entries(sources)
      .filter(([, content]) => DOM.test(content))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
