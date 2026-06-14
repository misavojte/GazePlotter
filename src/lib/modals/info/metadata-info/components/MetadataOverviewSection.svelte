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
    <div class="info-item">
      <span class="label">Event channels:</span>
      <span class="value">{overview.eventCounts.distinctChannels}</span>
    </div>
    <div class="info-item">
      <span class="label">Total events:</span>
      <span class="value">{overview.eventCounts.totalEvents}</span>
    </div>
    <div class="info-item">
      <span class="label">Capabilities:</span>
    </div>
    <div class="aoi-list">
      <div class="aoi-item">
        <span class="stimulus-name">Segmented</span>
        <span class="aoi-count">{overview.segmented ? 'Yes' : 'No'}</span>
      </div>
      <div class="aoi-item">
        <span class="stimulus-name">Spatial</span>
        <span class="aoi-count">{overview.spatial ? 'Yes' : 'No'}</span>
      </div>
      <div class="aoi-item">
        <span class="stimulus-name">Event</span>
        <span class="aoi-count">{overview.event ? 'Yes' : 'No'}</span>
      </div>
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

  {#if overview.eventCounts.distinctChannels > 0}
    <Card padding="sm" gap="0.5rem">
      <div class="info-item">
        <span class="label">Events per stimulus:</span>
      </div>
      <div class="aoi-list">
        {#each overview.eventCounts.perStimulus as stimulus}
          <div class="aoi-item">
            <span class="stimulus-name">{stimulus.stimulusName}</span>
            <span class="aoi-count"
              >{stimulus.channels} channel{stimulus.channels !== 1 ? 's' : ''},
              {stimulus.events} event{stimulus.events !== 1 ? 's' : ''}</span
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
