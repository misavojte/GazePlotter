<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { aoiModificationModal } from '$lib/modals/definitions'

  interface Props {
    stimulusId: number
    source: string
  }

  let { stimulusId, source }: Props = $props()

  const { modalState } = getGazePlotterSession()

  function openAois() {
    modalState.open(aoiModificationModal, {
      selectedStimulus: String(stimulusId),
      source,
    })
  }
</script>

<PaneSection title="Areas of Interest">
  <div class="aoi-helper-container">
    <p class="aoi-description">
      Areas of Interest (AOIs) map fixations to specific target regions on the stimulus. Editing the library updates display names, colors, and active visibility globally across all plots.
    </p>
    <PaneEditRow>
      <PaneEditLink onclick={openAois}>Configure AOI Library…</PaneEditLink>
    </PaneEditRow>
  </div>
</PaneSection>

<style>
  .aoi-helper-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .aoi-description {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: #4b5563;
  }
</style>
