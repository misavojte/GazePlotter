import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { main } from '../src/cli/gazeplotter'

// Runs the program in process, in this Node environment, which has no DOM.
expect(typeof document).toBe('undefined')

const GAZE = `Time,Participant,Stimulus,AOI
0,P1,Map_A,Region_1
1,P1,Map_A,Region_1
2,P1,Map_A,Region_2
3,P1,Map_A,
4,P2,Map_A,Region_1
5,P2,Map_A,Region_1
6,P1,Map_B,Region_1
7,P1,Map_B,Region_2
`

const run = async (argv: string[]) => {
  const out: string[] = []
  const err: string[] = []
  const code = await main(argv, { stdout: s => out.push(s), stderr: s => err.push(s) })
  return { code, out: out.join(''), err: err.join('') }
}

describe('cli', () => {
  it('prints usage without a command, and the catalog on request', async () => {
    const { code, err } = await run([])
    expect(code).toBe(1)
    expect(err).toContain('Usage:')
    const catalog = await run(['catalog'])
    expect(catalog.code).toBe(0)
    expect(JSON.parse(catalog.out).map((m: { id: string }) => m.id)).toContain('absoluteTime')
  })

  it('inspects, exports a table with its analysis and run record, and names mistakes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gazeplotter-'))
    const rec = join(dir, 'rec.csv')
    await writeFile(rec, GAZE)

    const seen = await run(['inspect', rec])
    expect(seen.code).toBe(0)
    expect(JSON.parse(seen.out).participants).toEqual(['P1', 'P2'])

    const out = join(dir, 'metrics.csv')
    const wrote = await run(['metrics', rec, '--metrics', 'all', '--out', out, '--codebook', '--format', 'wide', '--participants', 'P1,P2'])
    expect(wrote.code).toBe(0)
    expect(wrote.err).toMatch(/Wrote \d+ rows/)
    expect((await readFile(out, 'utf8')).startsWith('Participant_ID')).toBe(true)
    expect((await readFile(join(dir, 'metrics-codebook.csv'), 'utf8')).startsWith('Metric,Metric_ID')).toBe(true)
    const analysis = JSON.parse(await readFile(join(dir, 'metrics.analysis.json'), 'utf8'))
    expect(analysis.schema).toBe(1)
    const record = JSON.parse(await readFile(join(dir, 'metrics.run.json'), 'utf8'))
    expect(record.inputs[0].name).toBe('rec.csv')
    expect(record.inputs[0].sha256).toHaveLength(64)
    expect(record.participants).toEqual(['P1', 'P2'])

    const replayed = await run(['metrics', rec, '--analysis', join(dir, 'metrics.analysis.json')])
    expect(replayed.code).toBe(0)
    expect(replayed.out.startsWith('Participant_ID')).toBe(true)

    const unchosen = await run(['metrics', rec])
    expect(unchosen.code).toBe(1)
    expect(unchosen.err).toContain('Say which configured metrics')
    expect(unchosen.err).toContain('absoluteTime')

    const wrong = await run(['metrics', rec, '--metrics', 'nope'])
    expect(wrong.code).toBe(1)
    expect(wrong.err).toContain('No metric instance nope')

    const ghost = await run(['metrics', rec, '--metrics', 'all', '--participants', 'Ghost'])
    expect(ghost.code).toBe(2)
    expect(ghost.err).toContain('participants: Ghost')
    expect((await run(['metrics', rec, '--metrics', 'all', '--participants', 'Ghost', '--lenient'])).code).toBe(0)

    const bad = await run(['metrics', rec, '--metrics', 'all', '--start', 'soon'])
    expect(bad.code).toBe(1)
    expect(bad.err).toContain('--start')
  })
})
