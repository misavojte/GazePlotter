<script lang="ts">
  import MergeAxisModal, {
    STIMULUS_MERGE_AXIS,
  } from '../shared/MergeAxisModal.svelte'

  interface Props {
    source: string
  }

  let { source }: Props = $props()
</script>

<MergeAxisModal config={STIMULUS_MERGE_AXIS} {source} />
