<script lang="ts">
  import { PaneSection, PaneEditLink, PaneEditRow } from '$lib/workspace/pane'
  import { getGazePlotterSession } from '$lib/session'
  import { categoryModificationModal } from '$lib/modals/definitions'

  interface Props {
    source: string
  }

  let { source }: Props = $props()

  const { modalState } = getGazePlotterSession()

  function openCategories() {
    modalState.open(categoryModificationModal, {
      source,
    })
  }
</script>

<PaneSection title="Eye-movement Type">
  <div class="category-helper-container">
    <p class="category-description">
      Configure eye-movement classification categories (e.g. Saccades, Blinks). Editing the library updates display names, colors, and active visibility globally.
    </p>
    <PaneEditRow>
      <PaneEditLink onclick={openCategories}>Configure Category Library…</PaneEditLink>
    </PaneEditRow>
  </div>
</PaneSection>

<style>
  .category-helper-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-description {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: #4b5563;
  }
</style>
