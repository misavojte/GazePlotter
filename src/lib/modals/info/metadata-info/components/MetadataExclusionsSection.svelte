<script lang="ts">
  import type { DatasetExclusionNotice } from '$lib/data/types'
  import { describePairingError } from '$lib/data/intervalPairing'
  import { Card } from '$lib/shared/components'
  import MetadataSection from './MetadataSection.svelte'

  const { exclusions } = $props<{
    exclusions: DatasetExclusionNotice[]
  }>()

  // Group by stimulus so the report reads like the source: one interval, the
  // participants it was dropped for, and what was wrong.
  const byStimulus = $derived.by(() => {
    const map = new Map<string, DatasetExclusionNotice[]>()
    for (const notice of exclusions) {
      const list = map.get(notice.stimulus)
      if (list) list.push(notice)
      else map.set(notice.stimulus, [notice])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  })
</script>

{#if exclusions.length > 0}
  <MetadataSection title="Excluded data (malformed interval markers)">
    <Card padding="sm" gap="0.5rem">
      <p class="summary">
        {exclusions.length} participant-stimulus group{exclusions.length > 1
          ? 's were'
          : ' was'} excluded because their interval markers did not pair. Their
        gaze data is not part of the dataset.
      </p>
    </Card>

    {#each byStimulus as [stimulus, notices] (stimulus)}
      <Card padding="sm" gap="0.5rem">
        <div class="info-item">
          <span class="label">{stimulus}</span>
          <span class="value">{notices.length} excluded</span>
        </div>
        {#each notices as notice (notice.participant)}
          <div class="exclusion">
            <div class="participant">{notice.participant}</div>
            <ul class="issues">
              {#each notice.issues as issue (issue.kind + issue.timeSeconds)}
                <li>
                  {describePairingError(issue.kind)}
                  <span class="time">at {issue.timeSeconds.toFixed(2)} s</span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </Card>
    {/each}
  </MetadataSection>
{/if}

<style>
  .summary {
    margin: 0;
    color: #92400e;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .label {
    font-weight: 600;
    color: #374151;
  }

  .value {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .exclusion {
    border-top: 1px solid #e5e7eb;
    padding-top: 0.4rem;
  }

  .participant {
    font-weight: 500;
    color: #1f2937;
  }

  .issues {
    margin: 0.25rem 0 0;
    padding-left: 1.1rem;
    color: #991b1b;
    font-size: 0.85rem;
  }

  .time {
    color: #6b7280;
  }
</style>
