import type { ParticipantBarMetrics } from '$lib/plots/bar/types'

/**
 * Reduces a participant's per-AOI metric vector into a single scalar per
 * (metric, AOI) — the representation the correlation matrix operates on.
 *
 * Metrics that the bar plot treats as populations (avgDwellDuration,
 * avgFixationDuration — one value per fixation/dwell event) are collapsed
 * to the participant's mean here. Metrics tracked with a -1 sentinel for
 * "never seen" (ttff, firstFixationDuration) become NaN so upstream pair
 * dropping handles them uniformly with other missing data.
 *
 * Returns NaN when the metric is not defined for this (participant, AOI).
 */
export function perParticipantScalar(
  metrics: ParticipantBarMetrics,
  method: string,
  aoiIndex: number
): number {
  switch (method) {
    case 'absoluteTime':
      return metrics.dwellTime[aoiIndex]

    case 'relativeTime': {
      const dwell = metrics.dwellTime
      let total = 0
      for (let i = 0; i < dwell.length; i++) total += dwell[i]
      return total > 0 ? (dwell[aoiIndex] / total) * 100 : 0
    }

    case 'averageEntries':
      return metrics.entryCount[aoiIndex]

    case 'averageFixationCount':
      return metrics.fixationCount[aoiIndex]

    case 'avgDwellDuration': {
      const durations = metrics.dwellDurations[aoiIndex]
      if (!durations || durations.length === 0) return Number.NaN
      let sum = 0
      for (let i = 0; i < durations.length; i++) sum += durations[i]
      return sum / durations.length
    }

    case 'avgFixationDuration': {
      const durations = metrics.avgFixationDuration[aoiIndex]
      if (!durations || durations.length === 0) return Number.NaN
      let sum = 0
      for (let i = 0; i < durations.length; i++) sum += durations[i]
      return sum / durations.length
    }

    case 'timeToFirstFixation': {
      const v = metrics.ttff[aoiIndex]
      return v === -1 ? Number.NaN : v
    }

    case 'avgFirstFixationDuration': {
      const v = metrics.firstFixationDuration[aoiIndex]
      return v === -1 ? Number.NaN : v
    }

    default:
      return Number.NaN
  }
}
