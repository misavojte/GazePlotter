import { describe, it, expect } from 'vitest'
import { rqaScalar } from '../src/lib/metrics/core/rqa'

/** The matrix-based RQA the sequence scalars must equal exactly (the former implementation). */
function rqaFromMatrix(seq: number[], L: number) {
  const N = seq.length
  const m = new Uint8Array(N * N)
  let R = 0
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++)
      if (seq[i] === seq[j]) {
        m[i * N + j] = 1
        R++
      }
  const runs = (cells: (k: number) => boolean, length: number) => {
    let points = 0
    let run = 0
    for (let k = 0; k < length; k++) {
      if (cells(k)) run++
      else {
        if (run >= L) points += run
        run = 0
      }
    }
    return run >= L ? points + run : points
  }
  let DL = 0
  for (let k = 1; k < N; k++) DL += runs(i => m[i * N + i + k] === 1, N - k)
  let HL = 0
  for (let i = 0; i < N - 1; i++) HL += runs(x => m[i * N + i + 1 + x] === 1, N - i - 1)
  let VL = 0
  for (let j = 1; j < N; j++) VL += runs(i => m[i * N + j] === 1, j)
  return { R, REC: (200 * R) / (N * (N - 1)), DET: (100 * DL) / R, LAM: (100 * (HL + VL)) / (2 * R) }
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000)
}

describe('sequence RQA scalars equal the recurrence-matrix computation', () => {
  const rnd = rng(7)
  const cases: [number[], number][] = []
  for (let t = 0; t < 1500; t++) {
    const N = Math.floor(rnd() * 90)
    const categories = 1 + Math.floor(rnd() * 8)
    // Sticky sequences make long same-category runs, the LAM-heavy case.
    const stick = rnd()
    const seq: number[] = []
    for (let i = 0; i < N; i++)
      seq.push(i > 0 && rnd() < stick ? seq[i - 1] : Math.floor(rnd() * categories))
    cases.push([seq, 2 + Math.floor(rnd() * 5)])
  }

  it('REC, DET and LAM, including the no-pair and no-recurrence cases', () => {
    for (const [seq, L] of cases) {
      const label = `${seq.join(',')} L=${L}`
      if (seq.length < 2) {
        expect(rqaScalar(seq, L, 'REC', 0), label).toBeNaN()
        continue
      }
      const ref = rqaFromMatrix(seq, L)
      if (ref.R === 0) {
        expect(rqaScalar(seq, L, 'REC', 0), label).toBe(0)
        expect(rqaScalar(seq, L, 'DET'), label).toBeNaN()
        continue
      }
      expect(rqaScalar(seq, L, 'REC', 0), label).toBe(ref.REC)
      expect(rqaScalar(seq, L, 'DET'), label).toBe(ref.DET)
      expect(rqaScalar(seq, L, 'LAM'), label).toBe(ref.LAM)
    }
  })
})
