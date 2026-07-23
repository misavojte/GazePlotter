<script lang="ts">
  import MetadataSection from './MetadataSection.svelte'
  import InfoRow from './InfoRow.svelte'
  import { Card } from '$lib/shared/components'
  import type { MetadataOverview } from '../helpers'

  const { overview } = $props<{
    overview: MetadataOverview
  }>()
</script>

<MetadataSection title="Data overview">
  <Card padding="sm" gap="0.5rem">
    <InfoRow label="Number of stimuli:" value={overview.numberOfStimuli} />
    <InfoRow label="Number of participants:" value={overview.numberOfParticipants} />
    <InfoRow label="Total number of AOIs:" value={overview.aoiCounts.total} />
    <InfoRow label="Event channels:" value={overview.eventCounts.distinctChannels} />
    <InfoRow label="Total events:" value={overview.eventCounts.totalEvents} />
    <InfoRow label="Capabilities:" />
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
      <InfoRow label="AOIs per stimulus:" />
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
      <InfoRow label="Events per stimulus:" />
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
