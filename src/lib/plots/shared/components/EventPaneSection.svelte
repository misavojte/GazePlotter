<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { eventChannelModificationModal } from '$lib/modals/definitions'

  interface Props {
    stimulusId: number
    source: string
  }

  let { stimulusId, source }: Props = $props()

  const { modalState } = getGazePlotterSession()

  function openEvents() {
    modalState.open(eventChannelModificationModal, {
      selectedStimulus: String(stimulusId),
      source,
    })
  }
</script>

<PaneSection title="Events">
  <div class="event-helper-container">
    <p class="event-description">
      Configure events mapped to the stimulus. Editing the library updates display names, colors, and active visibility globally.
    </p>
    <PaneEditRow>
      <PaneEditLink onclick={openEvents}>Configure Event Library…</PaneEditLink>
    </PaneEditRow>
  </div>
</PaneSection>

<style>
  .event-helper-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .event-description {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: #4b5563;
  }
</style>
