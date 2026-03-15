import type { DataType } from '$lib/data/types'
import { jsonSegmentsToBinary, DEFAULT_NO_AOI_TREATMENT } from '$lib/data/types'

/**
 * Validates the basic structure of the data
 * @throws Error if the data structure is invalid
 */
export function validateBasicStructure(data: DataType): void {
  if (!data.stimuli?.data || !Array.isArray(data.stimuli.data)) {
    throw new Error('Invalid data structure: missing or invalid stimuli data')
  }
  if (!data.participants?.data || !Array.isArray(data.participants.data)) {
    throw new Error(
      'Invalid data structure: missing or invalid participants data'
    )
  }
}

/**
 * Normalizes and validates the data structure.
 * Ensures required fields exist and segments are properly formatted and sorted.
 */
export function processAndValidateData(
  data: Omit<DataType, 'segments'> & { segments?: any }
): DataType {
  const stimuliCount = data.stimuli.data.length

  // 1. Normalize basic metadata
  data.noAoiTreatment ??= { ...DEFAULT_NO_AOI_TREATMENT }
  data.aois.hiddenAois ??= []

  // Fill hiddenAois up to stimuliCount
  for (let s = data.aois.hiddenAois.length; s < stimuliCount; s++) {
    data.aois.hiddenAois.push([])
  }

  // 2. Validate and sort segments if they are in array format
  if (Array.isArray(data.segments)) {
    const rawSegments = data.segments as number[][][][]

    for (let s = 0; s < rawSegments.length; s++) {
      const stimSegments = rawSegments[s] || []
      rawSegments[s] = stimSegments

      for (let p = 0; p < stimSegments.length; p++) {
        const pSegments = stimSegments[p]
        if (!pSegments) {
          stimSegments[p] = []
          continue
        }

        // Inline validation and filtering to avoid extra passes
        const valid = []
        for (let i = 0; i < pSegments.length; i++) {
          const seg = pSegments[i]
          if (
            Array.isArray(seg) &&
            seg.length >= 3 &&
            typeof seg[0] === 'number' &&
            typeof seg[1] === 'number' &&
            typeof seg[2] === 'number'
          ) {
            valid.push(seg)
          }
        }

        // Sort in-place by start time
        valid.sort((a, b) => a[0] - b[0])
        stimSegments[p] = valid
      }
    }

    data.segments = jsonSegmentsToBinary(rawSegments)
  }

  return data as DataType
}
