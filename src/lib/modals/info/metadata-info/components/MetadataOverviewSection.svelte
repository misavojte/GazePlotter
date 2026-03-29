<script lang="ts">
  import MetadataSection from './MetadataSection.svelte'
  import { Card } from '$lib/shared/components'
  import type { MetadataOverview } from '../helpers'

  const { overview } = $props<{
    overview: MetadataOverview
  }>()
</script>

<MetadataSection title="Data overview">
  <Card padding="sm" gap="0.5rem">
    <div class="info-item">
      <span class="label">Number of stimuli:</span>
      <span class="value">{overview.numberOfStimuli}</span>
    </div>
    <div class="info-item">
      <span class="label">Number of participants:</span>
      <span class="value">{overview.numberOfParticipants}</span>
    </div>
    <div class="info-item">
      <span class="label">Total number of AOIs:</span>
      <span class="value">{overview.aoiCounts.total}</span>
    </div>
  </Card>

  {#if overview.aoiCounts.perStimulus.length > 0}
    <Card padding="sm" gap="0.5rem">
      <div class="info-item">
        <span class="label">AOIs per stimulus:</span>
      </div>
      <div class="aoi-list">
        {#each overview.aoiCounts.perStimulus as stimulus}
          <div class="aoi-item">
            <span class="stimulus-name">{stimulus.stimulusName}</span>
            <span class="aoi-count"
              >{stimulus.count} AOI{stimulus.count !== 1 ? 's' : ''}</span
            >
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</MetadataSection>

<style>
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .label {
    font-weight: 500;
    color: #374151;
    min-width: fit-content;
  }

  .value {
    color: #1f2937;
    text-align: right;
    word-break: break-word;
  }

  .aoi-list {
    margin-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .aoi-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .stimulus-name {
    color: #374151;
    font-weight: 500;
  }

  .aoi-count {
    color: #6b7280;
    font-size: 0.85rem;
  }
</style>
