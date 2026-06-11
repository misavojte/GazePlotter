<script lang="ts">
  import { Section, ModalButtons } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import {
    buildEventDataWithoutChannels,
    getEventChannelSummary,
  } from '$lib/data/engine'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
  const { engine, modalState, workspace } = getGazePlotterSession()

  const summary = getEventChannelSummary(engine)
  // Checked = keep. Default everything kept; pruning is opt-out.
  let kept: boolean[] = $state(summary.map(() => true))

  const removedCount = $derived(kept.filter(k => !k).length)

  const toggleAll = (value: boolean) => {
    kept = summary.map(() => value)
  }

  const handleApply = () => {
    const namesToRemove = new Set(
      summary.filter((_, i) => !kept[i]).map(entry => entry.name)
    )
    if (namesToRemove.size > 0) {
      // One undoable updateEventData command per affected stimulus.
      // (Hidden-channel lists are empty right after an import, so no
      // stale hidden ids can survive the replacement.)
      for (const update of buildEventDataWithoutChannels(
        engine,
        namesToRemove
      )) {
        workspace.updateEventData(
          update.stimulusId,
          update.channelDefs,
          update.eventBuffers,
          source
        )
      }
    }
    modalState.close()
  }
</script>

<Section>
  <p class="description">
    These event channels were imported with your data. Uncheck any you do
    not want to keep — you can also rename, recolor, or hide channels later
    via Event customization.
  </p>

  <div class="toggle-row">
    <button class="link-button" onclick={() => toggleAll(true)}>
      Keep all
    </button>
    <button class="link-button" onclick={() => toggleAll(false)}>
      Remove all
    </button>
  </div>

  <div class="channel-list">
    <div class="channel-row header">
      <span>Keep</span>
      <span>Event channel</span>
      <span class="count">Stimuli</span>
      <span class="count">Occurrences</span>
    </div>
    {#each summary as entry, i (entry.name)}
      <label class="channel-row">
        <input type="checkbox" bind:checked={kept[i]} />
        <span class="name">{entry.name}</span>
        <span class="count">{entry.stimulusCount}</span>
        <span class="count">{entry.occurrenceCount}</span>
      </label>
    {/each}
  </div>
</Section>

<ModalButtons
  buttons={[
    {
      label: removedCount > 0 ? `Remove ${removedCount} selected` : 'Keep all',
      onclick: handleApply,
      variant: 'primary',
    },
    { label: 'Cancel', onclick: () => modalState.close() },
  ]}
/>

<style>
  .description {
    margin: 0 0 0.75rem 0;
    color: var(--c-text);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .toggle-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .link-button {
    background: none;
    border: none;
    padding: 0;
    color: var(--c-brand, #cd1404);
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .channel-list {
    display: flex;
    flex-direction: column;
    max-height: 18rem;
    overflow-y: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  .channel-row {
    display: grid;
    grid-template-columns: 44px 1fr 70px 100px;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    font-size: 0.9rem;
    border-bottom: 1px solid #eee;
  }

  .channel-row:last-child {
    border-bottom: none;
  }

  .channel-row.header {
    font-weight: 500;
    font-size: 0.8rem;
    color: #666;
    background: #fafafa;
  }

  label.channel-row {
    cursor: pointer;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    text-align: right;
    color: #666;
  }
</style>
