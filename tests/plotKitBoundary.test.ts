import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

// Plots are plain modules; the shared platform owns every rune (see the
// `src/lib/plots/shared/kit.ts` header for why). Enforced here: a module that
// defines a kit, and every plot module it reaches, imports no `svelte` runtime
// and no runes or component module (type-only imports are erased and allowed;
// modules outside the plots are leaves, not followed); no plot folder holds a
// `.svelte` or `.svelte.ts` file; only `PlotCanvas` runs the engine.

const sources = import.meta.glob('/src/lib/plots/**/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const IMPORT = /^\s*(import|export)\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm

/** True when the statement brings in no value: `import type`, or every named item is `type X`. */
function typeOnly(clause: string): boolean {
  if (/^type\b/.test(clause)) return true
  const named = clause.match(/^\{([^}]*)\}$/)
  if (!named) return false
  const items = named[1].split(',').map(s => s.trim()).filter(Boolean)
  return items.length > 0 && items.every(item => item.startsWith('type '))
}

/** The plot module a specifier names, or null for anything outside the plots. */
function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('$lib/')
    ? '/src/lib/' + spec.slice(5)
    : spec.startsWith('.')
      ? posix.join(posix.dirname(from), spec)
      : null
  if (base === null || !base.startsWith('/src/lib/plots/')) return null
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (candidate in sources) return candidate
  }
  // A `.svelte` component (no `.ts` source to read): reported, never followed.
  return base
}

const isReactive = (file: string) => file.endsWith('.svelte') || file.endsWith('.svelte.ts')

/** Every value import, from a kit outward, that reaches the Svelte runtime. */
function violationsFrom(kit: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const walk = (file: string, via: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const [, , clause, spec] of (sources[file] ?? '').matchAll(IMPORT)) {
      if (typeOnly(clause.trim())) continue
      if (spec === 'svelte' || spec.startsWith('svelte/')) {
        out.push(`${via} → ${file}: '${spec}'`)
        continue
      }
      const target = resolve(file, spec)
      if (target === null) continue
      if (isReactive(target)) {
        out.push(`${via} → ${file}: '${spec}'`)
        continue
      }
      walk(target, via)
    }
  }
  walk(kit, kit)
  return out
}

// Every component and runes module under src: where the canvas engine is used.
const svelteSources = import.meta.glob(['/src/**/*.svelte', '/src/**/*.svelte.ts'], {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const kits = Object.entries(sources)
  .filter(([file, content]) => file !== '/src/lib/plots/shared/kit.ts' && /\bdefineKit</.test(content))
  .map(([file]) => file)

describe('plot kit boundary', () => {
  it('finds the kits', () => {
    expect(kits).toContain('/src/lib/plots/shared/matrixKit.ts')
    expect(kits).toContain('/src/lib/plots/evolving-metrics/core/kit.ts')
  })

  it('a kit reaches no Svelte runtime, runes module or component', () => {
    expect(kits.flatMap(violationsFrom)).toEqual([])
  })

  it('catches a runes import', () => {
    const file = '/src/lib/plots/shared/__probe.ts'
    sources[file] = "import { usePlot } from './usePlot.svelte'\nimport type { X } from './plotCursor.svelte'"
    try {
      expect(violationsFrom(file)).toEqual([`${file} → ${file}: './usePlot.svelte'`])
    } finally {
      delete sources[file]
    }
  })

  it('only the one host runs the canvas engine: no per-plot figure', () => {
    const callers = Object.entries(svelteSources)
      .filter(([file]) => file !== '/src/lib/plots/shared/usePlot.svelte.ts')
      .filter(([, content]) => /\busePlot\s*[<(]/.test(content))
      .map(([file]) => file)
    expect(callers).toEqual(['/src/lib/plots/shared/components/PlotCanvas.svelte'])
  })

  it('a plot folder is plain TS: every rune lives in the shared platform', () => {
    const reactive = Object.keys(svelteSources).filter(
      file => file.startsWith('/src/lib/plots/') && !file.startsWith('/src/lib/plots/shared/')
    )
    expect(reactive).toEqual([])
  })
})
