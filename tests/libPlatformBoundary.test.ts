import { describe, expect, it } from 'vitest'

// The desktop shell (PLANDESKTOP.md) consumes src/lib as a platform-blind
// library; anything tying it to the SvelteKit website host belongs in
// src/routes. Pinned so the boundary survives future edits.

const sources = import.meta.glob('/src/lib/**/*.{ts,js,svelte}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const FORBIDDEN: Array<[RegExp, string]> = [
  [/['"]\$app\//, '$app/* (SvelteKit runtime)'],
  [/['"]\$service-worker['"]/, '$service-worker (website offline cache)'],
  [/['"]\$env\//, '$env/* (SvelteKit env)'],
  [/['"]\$survey/, '$survey (website survey subsystem)'],
  [/['"]@sveltejs\//, '@sveltejs/* (host framework)'],
  [/['"][^'"]*\/routes\//, 'src/routes (website host)'],
]

describe('src/lib platform boundary', () => {
  it('glob actually finds the library', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('module scope holds no reactive state', () => {
    // Per-session state goes through sessionScoped; column-0 declarations
    // only, so component/class/function state stays untouched.
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.endsWith('.svelte'))
      .filter(([, content]) =>
        /^(?:export )?(?:let|const|var) [^\n]*\$state[.(]/m.test(content)
      )
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('root-level :global styling exists only in DesignTokens.svelte', () => {
    // Descendant-scoped :global(el) is not covered here.
    const offenders = Object.keys(sources).filter(
      file =>
        sources[file].includes(':global(:root') &&
        file !== '/src/lib/DesignTokens.svelte'
    )
    expect(offenders).toEqual([])
  })

  it('never imports the website host', () => {
    const violations: string[] = []
    for (const [file, content] of Object.entries(sources)) {
      // Whole-file prefilter; only hits pay for the line-numbered report.
      if (!FORBIDDEN.some(([pattern]) => pattern.test(content))) continue
      content.split('\n').forEach((line, i) => {
        for (const [pattern, label] of FORBIDDEN) {
          if (pattern.test(line)) {
            violations.push(`${file}:${i + 1} references ${label}: ${line.trim()}`)
          }
        }
      })
    }
    expect(violations).toEqual([])
  })
})
