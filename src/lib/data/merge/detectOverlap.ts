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

  // getSegmentCount addresses (stimulus, participant); orient it so `entity`
  // is the merged axis and `counterpart` the other one.
  const onParticipants = axis === 'participant'
  const counterpartCount = onParticipants ? stimuliCount : maxParticipants
  const segmentCount = (counterpart: number, entity: number) =>
    onParticipants
      ? reader.getSegmentCount(counterpart, entity)
      : reader.getSegmentCount(entity, counterpart)

  for (let c = 0; c < counterpartCount; c++) {
    let withData = 0
    for (const id of entities) {
      if (segmentCount(c, id) > 0 && ++withData > 1) break
    }
    if (withData > 1) conflicts.push(c)
  }

  return conflicts
}
