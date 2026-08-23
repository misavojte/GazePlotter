<script lang="ts">
  import MergeAxisModal, {
    PARTICIPANT_MERGE_AXIS,
  } from '../shared/MergeAxisModal.svelte'

  export interface Props {
    source: string
  }

  let { source }: Props = $props()
</script>

<MergeAxisModal config={PARTICIPANT_MERGE_AXIS} {source} />
