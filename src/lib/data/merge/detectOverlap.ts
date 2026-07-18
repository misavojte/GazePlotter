import type { BinaryBufferReader } from '$lib/data/binary'

/**
 * Overlap gate for a would-be merge (see PLANMERGE.md M2 / §4). A merge is only
 * allowed when it is DISJOINT: no counterpart-axis cell holds segments for more
 * than one of {representative, ...members}. This is the non-throwing pre-check
 * the modal uses to decide between committing the merge and showing the refusal
 * ("these recordings overlap for N …"); the pure fold also asserts disjointness
 * as a safety net.
 *
 * Returns the conflicting counterpart ids (stimulus ids for a participant merge,
 * participant ids for a stimulus merge). Empty ⇒ disjoint ⇒ safe to merge.
 */
export function detectMergeOverlap(
  reader: BinaryBufferReader,
  axis: 'stimulus' | 'participant',
  representativeId: number,
  memberIds: number[]
): number[] {
  const { stimuliCount, maxParticipants } = reader.getBuffers()
  const entities = [representativeId, ...memberIds]
  const conflicts: number[] = []

  if (axis === 'participant') {
    // Entities are participants; the counterpart axis is stimulus.
    for (let s = 0; s < stimuliCount; s++) {
      let withData = 0
      for (const pid of entities) {
        if (reader.getSegmentCount(s, pid) > 0 && ++withData > 1) break
      }
      if (withData > 1) conflicts.push(s)
    }
  } else {
    // Entities are stimuli; the counterpart axis is participant.
    for (let p = 0; p < maxParticipants; p++) {
      let withData = 0
      for (const sid of entities) {
        if (reader.getSegmentCount(sid, p) > 0 && ++withData > 1) break
      }
      if (withData > 1) conflicts.push(p)
    }
  }

  return conflicts
}
