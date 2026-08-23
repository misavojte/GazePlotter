import { withQualifiers } from '$lib/plots/shared/labels'

export const MARGIN = {
  RIGHT: 10,
}

// Time is the main axis here, so the binning window trails as a mid-dot
// qualifier (e.g. "Elapsed time / ms · 1000 ms window / 100 ms step"); no
// time-range qualifier — the axis itself shows the range.
export function getEvolvingMetricsXAxisLabel(windowDesc: string): string {
  return withQualifiers('Elapsed time / ms', windowDesc)
}
